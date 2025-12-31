<script lang="ts">
  import { api, type WorkoutRoutine, type WorkoutDay, type Exercise, type WorkoutSession, type ExerciseLog } from '$lib/api';
  import { onMount } from 'svelte';
  import { session, loggedExerciseIds, personalRecords, prsByExercise } from '$lib/stores/session';

  let routines = $state<WorkoutRoutine[]>([]);
  let selectedRoutine = $state<WorkoutRoutine | null>(null);
  let todaysWorkout = $state<WorkoutDay | null>(null);
  let loading = $state(true);
  let activeTab = $state<'today' | 'routines' | 'progress'>('today');
  let showCreateModal = $state(false);
  let showEditModal = $state(false);
  let editingDay = $state<WorkoutDay | null>(null);

  // Session state
  let activeSession = $state<WorkoutSession | null>(null);
  let sessionLoading = $state(false);
  let lastPR = $state<{ exerciseName: string; weight: string } | null>(null);
  let showPRToast = $state(false);

  const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  // Subscribe to session store
  $effect(() => {
    const unsubscribe = session.subscribe(s => {
      activeSession = s;
    });
    return unsubscribe;
  });

  onMount(async () => {
    await loadData();
    // Load active session if any
    await session.loadActive();
    // Load PRs
    await personalRecords.load();
  });

  async function loadData(showLoading = true) {
    if (showLoading) loading = true;
    try {
      const [routinesData, todaysData] = await Promise.all([
        api.getWorkoutRoutines(),
        api.getTodaysWorkout()
      ]);
      routines = routinesData;
      todaysWorkout = todaysData;
      if (routines.length > 0) {
        selectedRoutine = routines.find(r => r.is_active) || routines[0];
      }
    } catch (e) {
      console.error('Failed to load workouts:', e);
    } finally {
      loading = false;
    }
  }

  async function refreshData() {
    await loadData(false);
  }

  function getDayName(dayOfWeek: number | null): string {
    if (dayOfWeek === null) return 'Flexible';
    return dayNames[dayOfWeek];
  }

  function getTodayDayOfWeek(): number {
    const day = new Date().getDay();
    return day === 0 ? 6 : day - 1; // Convert Sunday=0 to Monday=0 format
  }

  function formatRestTime(seconds: number | null): string {
    if (!seconds) return '';
    if (seconds < 60) return `${seconds}s rest`;
    return `${Math.floor(seconds / 60)}m rest`;
  }

  async function handleCreateRoutine(event: SubmitEvent) {
    event.preventDefault();
    const form = event.target as HTMLFormElement;
    const formData = new FormData(form);

    const routine = {
      name: formData.get('name') as string,
      description: formData.get('description') as string || undefined,
      days: []
    };

    try {
      await api.createWorkoutRoutine(routine);
      showCreateModal = false;
      await loadData();
    } catch (e) {
      console.error('Failed to create routine:', e);
    }
  }

  async function handleAddDay() {
    if (!selectedRoutine?.id) return;

    const newDay = {
      name: 'New Day',
      day_of_week: null,
      sort_order: selectedRoutine.days.length,
      exercises: []
    };

    try {
      await api.createWorkoutDay(selectedRoutine.id, newDay);
      await refreshData();
    } catch (e) {
      console.error('Failed to add day:', e);
    }
  }

  async function handleAddExercise(dayId: number) {
    const newExercise = {
      name: 'New Exercise',
      target_sets: 3,
      target_reps: '8-12',
      target_weight: null,
      rest_seconds: 90,
      notes: null,
      sort_order: 0
    };

    try {
      await api.createExercise(dayId, newExercise);
      await refreshData();
    } catch (e) {
      console.error('Failed to add exercise:', e);
    }
  }

  async function handleUpdateExercise(exerciseId: number, field: string, value: string | number | null) {
    try {
      await api.updateExercise(exerciseId, { [field]: value });
      await refreshData();
    } catch (e) {
      console.error('Failed to update exercise:', e);
    }
  }

  function adjustWeight(exercise: Exercise, delta: number) {
    const currentWeight = exercise.target_weight || '0';
    // Extract numeric value from weight string (e.g., "135 lbs" -> 135)
    const match = currentWeight.match(/^(\d+(?:\.\d+)?)/);
    const numericWeight = match ? parseFloat(match[1]) : 0;
    const newWeight = Math.max(0, numericWeight + delta);
    // Preserve the unit if it exists (must be letters only, not digits)
    const unitMatch = currentWeight.match(/\s+([a-zA-Z]+)$/);
    const unit = unitMatch ? unitMatch[1] : '';
    const newWeightStr = newWeight > 0 ? (unit ? `${newWeight} ${unit}` : `${newWeight}`) : null;
    if (exercise.id) {
      handleUpdateExercise(exercise.id, 'target_weight', newWeightStr);
    }
  }

  async function handleDeleteExercise(exerciseId: number) {
    try {
      await api.deleteExercise(exerciseId);
      await refreshData();
    } catch (e) {
      console.error('Failed to delete exercise:', e);
    }
  }

  async function handleUpdateDay(dayId: number, field: string, value: string | number | null) {
    try {
      await api.updateWorkoutDay(dayId, { [field]: value });
      await refreshData();
    } catch (e) {
      console.error('Failed to update day:', e);
    }
  }

  async function handleDeleteDay(dayId: number) {
    try {
      await api.deleteWorkoutDay(dayId);
      await refreshData();
    } catch (e) {
      console.error('Failed to delete day:', e);
    }
  }

  function openEditDay(day: WorkoutDay) {
    editingDay = { ...day };
    showEditModal = true;
  }

  // Workout Session Functions
  async function startWorkout() {
    if (!todaysWorkout) return;
    sessionLoading = true;
    try {
      const today = new Date().toISOString().split('T')[0];
      await session.start(todaysWorkout.id ?? null, today);
    } catch (e) {
      console.error('Failed to start workout:', e);
    } finally {
      sessionLoading = false;
    }
  }

  async function completeExercise(exercise: Exercise) {
    if (!activeSession || !exercise.id) return;

    // Check if already logged
    const alreadyLogged = activeSession.exercise_logs.some(l => l.exercise_id === exercise.id);
    if (alreadyLogged) return;

    sessionLoading = true;
    try {
      const log = await session.logExercise({
        exercise_id: exercise.id,
        exercise_name: exercise.name,
        sets_completed: exercise.target_sets ?? 3,
        reps_achieved: exercise.target_reps ?? null,
        weight_used: exercise.target_weight ?? null,
      });

      // Check for PR and show toast
      if (log.is_pr && exercise.target_weight) {
        lastPR = { exerciseName: exercise.name, weight: exercise.target_weight };
        showPRToast = true;
        // Reload PRs
        await personalRecords.load();
        // Hide toast after 3 seconds
        setTimeout(() => {
          showPRToast = false;
        }, 3000);
      }
    } catch (e) {
      console.error('Failed to log exercise:', e);
    } finally {
      sessionLoading = false;
    }
  }

  async function undoExercise(exercise: Exercise) {
    if (!activeSession || !exercise.id) return;

    const log = activeSession.exercise_logs.find(l => l.exercise_id === exercise.id);
    if (!log) return;

    sessionLoading = true;
    try {
      await session.undoExercise(log.id);
    } catch (e) {
      console.error('Failed to undo exercise:', e);
    } finally {
      sessionLoading = false;
    }
  }

  async function completeWorkout() {
    sessionLoading = true;
    try {
      await session.complete();
    } catch (e) {
      console.error('Failed to complete workout:', e);
    } finally {
      sessionLoading = false;
    }
  }

  async function cancelWorkout() {
    sessionLoading = true;
    try {
      await session.cancel();
    } catch (e) {
      console.error('Failed to cancel workout:', e);
    } finally {
      sessionLoading = false;
    }
  }

  function isExerciseLogged(exerciseId: number): boolean {
    if (!activeSession) return false;
    return activeSession.exercise_logs.some(l => l.exercise_id === exerciseId);
  }

  function getExerciseLog(exerciseId: number): ExerciseLog | undefined {
    if (!activeSession) return undefined;
    return activeSession.exercise_logs.find(l => l.exercise_id === exerciseId);
  }

  function getCompletedCount(): number {
    if (!activeSession || !todaysWorkout) return 0;
    return activeSession.exercise_logs.filter(l =>
      todaysWorkout!.exercises.some(e => e.id === l.exercise_id)
    ).length;
  }
</script>

<div class="container">
  <div class="page-header">
    <h1>Workouts</h1>
    <p class="subtitle">Your gym routines and exercises</p>
  </div>

  {#if loading}
    <div class="loading-state">
      <div class="loading-spinner"></div>
      <p>Loading workouts...</p>
    </div>
  {:else}
    <div class="tabs">
      <button
        class="tab"
        class:active={activeTab === 'today'}
        onclick={() => activeTab = 'today'}
      >
        Today's Workout
        {#if activeSession}
          <span class="active-badge">Active</span>
        {/if}
      </button>
      <button
        class="tab"
        class:active={activeTab === 'routines'}
        onclick={() => activeTab = 'routines'}
      >
        My Routines
      </button>
      <button
        class="tab"
        class:active={activeTab === 'progress'}
        onclick={() => activeTab = 'progress'}
      >
        Progress
      </button>
    </div>

    {#if activeTab === 'today'}
      <div class="today-section">
        {#if todaysWorkout}
          <div class="workout-card today-workout" class:active-workout={activeSession}>
            <div class="workout-header">
              <div class="workout-title">
                <span class="day-badge">{getDayName(todaysWorkout.day_of_week)}</span>
                <h2>{todaysWorkout.name}</h2>
              </div>
              {#if activeSession}
                <div class="session-progress">
                  <span class="progress-text">{getCompletedCount()}/{todaysWorkout.exercises.length}</span>
                  <div class="progress-bar">
                    <div
                      class="progress-fill"
                      style="width: {(getCompletedCount() / todaysWorkout.exercises.length) * 100}%"
                    ></div>
                  </div>
                </div>
              {:else}
                <span class="exercise-count">{todaysWorkout.exercises.length} exercises</span>
              {/if}
            </div>

            {#if !activeSession}
              <div class="start-section">
                <button
                  class="btn btn-primary btn-large start-workout-btn"
                  onclick={startWorkout}
                  disabled={sessionLoading}
                >
                  {#if sessionLoading}
                    Starting...
                  {:else}
                    Start Workout
                  {/if}
                </button>
              </div>
            {/if}

            <div class="exercises-list">
              {#each [...todaysWorkout.exercises].sort((a, b) => a.sort_order - b.sort_order) as exercise}
                {@const isLogged = exercise.id ? isExerciseLogged(exercise.id) : false}
                {@const exerciseLog = exercise.id ? getExerciseLog(exercise.id) : undefined}
                <div
                  class="exercise-item"
                  class:completed={isLogged}
                  class:clickable={activeSession && !isLogged}
                  onclick={() => activeSession && !isLogged && exercise.id && completeExercise(exercise)}
                >
                  <div class="exercise-main">
                    <div class="exercise-left">
                      {#if activeSession}
                        <div class="checkbox" class:checked={isLogged}>
                          {#if isLogged}
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                              <polyline points="20 6 9 17 4 12"></polyline>
                            </svg>
                          {/if}
                        </div>
                      {/if}
                      <span class="exercise-name" class:strikethrough={isLogged}>{exercise.name}</span>
                      {#if exerciseLog?.is_pr}
                        <span class="pr-badge">PR!</span>
                      {/if}
                    </div>
                    <div class="exercise-details">
                      {#if exercise.target_sets}
                        <span class="detail-badge sets">{exercise.target_sets} sets</span>
                      {/if}
                      {#if exercise.target_reps}
                        <span class="detail-badge reps">{exercise.target_reps} reps</span>
                      {/if}
                      {#if exercise.target_weight}
                        <span class="detail-badge weight">{exercise.target_weight}</span>
                      {/if}
                    </div>
                  </div>
                  {#if (exercise.rest_seconds || exercise.notes) && !isLogged}
                    <div class="exercise-meta">
                      {#if exercise.rest_seconds}
                        <span class="rest-time">{formatRestTime(exercise.rest_seconds)}</span>
                      {/if}
                      {#if exercise.notes}
                        <span class="exercise-notes">{exercise.notes}</span>
                      {/if}
                    </div>
                  {/if}
                  {#if isLogged && activeSession}
                    <button
                      class="undo-btn"
                      onclick={(e) => { e.stopPropagation(); undoExercise(exercise); }}
                      title="Undo"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
                        <path d="M3 3v5h5"/>
                      </svg>
                    </button>
                  {/if}
                </div>
              {/each}
            </div>

            {#if activeSession}
              <div class="session-actions">
                <button
                  class="btn btn-secondary"
                  onclick={cancelWorkout}
                  disabled={sessionLoading}
                >
                  Cancel
                </button>
                <button
                  class="btn btn-primary btn-large"
                  onclick={completeWorkout}
                  disabled={sessionLoading || getCompletedCount() === 0}
                >
                  {#if sessionLoading}
                    Saving...
                  {:else}
                    Complete Workout ({getCompletedCount()}/{todaysWorkout.exercises.length})
                  {/if}
                </button>
              </div>
            {/if}
          </div>
        {:else}
          <div class="empty-state">
            <div class="empty-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M20.57 14.86L22 13.43 20.57 12 17 15.57 8.43 7 12 3.43 10.57 2 9.14 3.43 7.71 2 5.57 4.14 4.14 2.71 2.71 4.14l1.43 1.43L2 7.71l1.43 1.43L2 10.57 3.43 12 7 8.43 15.57 17 12 20.57 13.43 22l1.43-1.43L16.29 22l2.14-2.14 1.43 1.43 1.43-1.43-1.43-1.43L22 16.29z"/>
              </svg>
            </div>
            <h3>No workout scheduled for today</h3>
            <p>Create a routine and assign workouts to days of the week to see your daily workout here.</p>
            <button class="btn btn-primary" onclick={() => activeTab = 'routines'}>
              View Routines
            </button>
          </div>
        {/if}
      </div>
    {:else}
      <div class="routines-section">
        {#if routines.length === 0}
          <div class="empty-state">
            <div class="empty-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M12 5v14M5 12h14"/>
              </svg>
            </div>
            <h3>No workout routines yet</h3>
            <p>Create your first workout routine to start tracking your gym sessions.</p>
            <button class="btn btn-primary" onclick={() => showCreateModal = true}>
              Create Routine
            </button>
          </div>
        {:else}
          <div class="routines-header">
            <select
              class="routine-select"
              onchange={(e) => {
                const id = parseInt((e.target as HTMLSelectElement).value);
                selectedRoutine = routines.find(r => r.id === id) || null;
              }}
            >
              {#each routines as routine}
                <option value={routine.id} selected={routine.id === selectedRoutine?.id}>
                  {routine.name} {routine.is_active ? '(Active)' : ''}
                </option>
              {/each}
            </select>
            <button class="btn btn-secondary" onclick={() => showCreateModal = true}>
              + New Routine
            </button>
          </div>

          {#if selectedRoutine}
            <div class="routine-content">
              {#if selectedRoutine.description}
                <p class="routine-description">{selectedRoutine.description}</p>
              {/if}

              <div class="days-grid">
                {#each [...selectedRoutine.days].sort((a, b) => a.sort_order - b.sort_order) as day}
                  <div class="day-card">
                    <div class="day-header">
                      <div class="day-info">
                        <select
                          class="day-select"
                          value={day.day_of_week ?? ''}
                          onchange={(e) => {
                            const val = (e.target as HTMLSelectElement).value;
                            handleUpdateDay(day.id!, 'day_of_week', val === '' ? null : parseInt(val));
                          }}
                        >
                          <option value="">Flexible</option>
                          {#each dayNames as name, i}
                            <option value={i}>{name}</option>
                          {/each}
                        </select>
                        <input
                          type="text"
                          class="day-name-input"
                          value={day.name}
                          onblur={(e) => handleUpdateDay(day.id!, 'name', (e.target as HTMLInputElement).value)}
                        />
                      </div>
                      <button class="icon-btn delete" onclick={() => handleDeleteDay(day.id!)} title="Delete day">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                        </svg>
                      </button>
                    </div>

                    <div class="day-exercises">
                      {#each [...day.exercises].sort((a, b) => a.sort_order - b.sort_order) as exercise}
                        <div class="exercise-edit-item">
                          <div class="exercise-edit-row">
                            <input
                              type="text"
                              class="exercise-name-input"
                              value={exercise.name}
                              onblur={(e) => handleUpdateExercise(exercise.id!, 'name', (e.target as HTMLInputElement).value)}
                            />
                            <button class="icon-btn delete small" onclick={() => handleDeleteExercise(exercise.id!)} title="Delete exercise">
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M18 6L6 18M6 6l12 12"/>
                              </svg>
                            </button>
                          </div>
                          <div class="exercise-edit-details">
                            <div class="detail-input-group">
                              <label>Sets</label>
                              <input
                                type="number"
                                value={exercise.target_sets ?? ''}
                                onblur={(e) => handleUpdateExercise(exercise.id!, 'target_sets', parseInt((e.target as HTMLInputElement).value) || null)}
                              />
                            </div>
                            <div class="detail-input-group">
                              <label>Reps</label>
                              <input
                                type="text"
                                value={exercise.target_reps ?? ''}
                                placeholder="8-12"
                                onblur={(e) => handleUpdateExercise(exercise.id!, 'target_reps', (e.target as HTMLInputElement).value || null)}
                              />
                            </div>
                            <div class="detail-input-group weight-group">
                              <label>🏋️ Weight</label>
                              <div class="weight-controls">
                                <button
                                  type="button"
                                  class="weight-btn minus"
                                  onclick={() => adjustWeight(exercise, -5)}
                                  title="Decrease by 5"
                                >-5</button>
                                <input
                                  type="text"
                                  class="weight-input"
                                  value={exercise.target_weight ?? ''}
                                  placeholder="135 lbs"
                                  onblur={(e) => handleUpdateExercise(exercise.id!, 'target_weight', (e.target as HTMLInputElement).value || null)}
                                />
                                <button
                                  type="button"
                                  class="weight-btn plus"
                                  onclick={() => adjustWeight(exercise, 5)}
                                  title="Increase by 5"
                                >+5</button>
                              </div>
                            </div>
                          </div>
                        </div>
                      {/each}
                      <button class="add-exercise-btn" onclick={() => handleAddExercise(day.id!)}>
                        + Add Exercise
                      </button>
                    </div>
                  </div>
                {/each}

                <button class="add-day-card" onclick={handleAddDay}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M12 5v14M5 12h14"/>
                  </svg>
                  <span>Add Day</span>
                </button>
              </div>
            </div>
          {/if}
        {/if}
      </div>
    {:else if activeTab === 'progress'}
      <div class="progress-section">
        <div class="progress-placeholder">
          <div class="empty-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M3 3v18h18"/>
              <path d="M18.7 8l-5.1 5.2-2.8-2.7L7 14.3"/>
            </svg>
          </div>
          <h3>Track Your Progress</h3>
          <p>Complete workouts to see your exercise progression and PRs here.</p>
          <p class="progress-note">Charts and detailed history coming soon!</p>
        </div>
      </div>
    {/if}
  {/if}
</div>

<!-- PR Toast Notification -->
{#if showPRToast && lastPR}
  <div class="pr-toast">
    <div class="pr-toast-content">
      <span class="pr-icon">🏆</span>
      <div class="pr-text">
        <strong>New PR!</strong>
        <span>{lastPR.exerciseName} @ {lastPR.weight}</span>
      </div>
    </div>
  </div>
{/if}

{#if showCreateModal}
  <div class="modal-overlay" onclick={() => showCreateModal = false}>
    <div class="modal" onclick={(e) => e.stopPropagation()}>
      <h2>Create Workout Routine</h2>
      <form onsubmit={handleCreateRoutine}>
        <div class="form-group">
          <label for="name">Routine Name</label>
          <input type="text" id="name" name="name" required placeholder="e.g., Push Pull Legs" />
        </div>
        <div class="form-group">
          <label for="description">Description (optional)</label>
          <textarea id="description" name="description" rows="3" placeholder="Describe your routine..."></textarea>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn btn-secondary" onclick={() => showCreateModal = false}>Cancel</button>
          <button type="submit" class="btn btn-primary">Create Routine</button>
        </div>
      </form>
    </div>
  </div>
{/if}

<style>
  .page-header {
    margin-bottom: var(--space-xl);
  }

  .page-header h1 {
    font-size: 2.5rem;
    margin-bottom: var(--space-sm);
  }

  .subtitle {
    font-size: 1.125rem;
    color: var(--color-text-muted);
  }

  .loading-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--space-md);
    padding: var(--space-2xl);
    color: var(--color-text-muted);
  }

  .loading-spinner {
    width: 40px;
    height: 40px;
    border: 3px solid var(--color-border);
    border-top-color: var(--color-primary);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .tabs {
    display: flex;
    gap: var(--space-sm);
    margin-bottom: var(--space-xl);
    border-bottom: 1px solid var(--color-border-light);
    padding-bottom: var(--space-sm);
  }

  .tab {
    padding: var(--space-sm) var(--space-lg);
    font-weight: 500;
    color: var(--color-text-muted);
    border-radius: var(--radius-sm) var(--radius-sm) 0 0;
    transition: all var(--transition-fast);
    position: relative;
  }

  .tab:hover {
    color: var(--color-text);
    background: var(--color-bg-hover);
  }

  .tab.active {
    color: var(--color-primary);
  }

  .tab.active::after {
    content: '';
    position: absolute;
    bottom: calc(-1 * var(--space-sm) - 1px);
    left: 0;
    right: 0;
    height: 2px;
    background: var(--color-primary);
  }

  /* Today's Workout Section */
  .today-workout {
    background: var(--color-bg-card);
    border-radius: var(--radius-xl);
    padding: var(--space-xl);
    box-shadow: var(--shadow-md);
    border: 1px solid var(--color-border-light);
  }

  .workout-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: var(--space-xl);
    padding-bottom: var(--space-lg);
    border-bottom: 1px solid var(--color-border-light);
  }

  .workout-title {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
  }

  .workout-title h2 {
    font-size: 1.5rem;
    margin: 0;
  }

  .day-badge {
    display: inline-block;
    padding: var(--space-xs) var(--space-sm);
    background: rgba(var(--color-primary-rgb), 0.1);
    color: var(--color-primary);
    border-radius: var(--radius-full);
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    width: fit-content;
  }

  .exercise-count {
    color: var(--color-text-muted);
    font-size: 0.875rem;
  }

  .exercises-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-md);
  }

  .exercise-item {
    padding: var(--space-md);
    background: var(--color-bg);
    border-radius: var(--radius-md);
    border: 1px solid var(--color-border-light);
  }

  .exercise-main {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: var(--space-sm);
  }

  .exercise-name {
    font-weight: 600;
    color: var(--color-text);
    font-size: 1rem;
  }

  .exercise-details {
    display: flex;
    gap: var(--space-sm);
    flex-wrap: wrap;
  }

  .detail-badge {
    padding: var(--space-xs) var(--space-sm);
    border-radius: var(--radius-sm);
    font-size: 0.8rem;
    font-weight: 500;
  }

  .detail-badge.sets {
    background: var(--color-primary-light);
    color: var(--color-primary-dark);
  }

  .detail-badge.reps {
    background: var(--color-success-light);
    color: var(--color-success);
  }

  .detail-badge.weight {
    background: var(--color-warning-light);
    color: #8B6914;
  }

  .exercise-meta {
    margin-top: var(--space-sm);
    padding-top: var(--space-sm);
    border-top: 1px dashed var(--color-border-light);
    display: flex;
    gap: var(--space-md);
    flex-wrap: wrap;
    font-size: 0.85rem;
    color: var(--color-text-muted);
  }

  .rest-time {
    display: flex;
    align-items: center;
    gap: var(--space-xs);
  }

  .exercise-notes {
    font-style: italic;
  }

  /* Empty State */
  .empty-state {
    text-align: center;
    padding: var(--space-2xl);
    background: var(--color-bg-card);
    border-radius: var(--radius-xl);
    border: 2px dashed var(--color-border);
  }

  .empty-icon {
    color: var(--color-text-muted);
    margin-bottom: var(--space-lg);
  }

  .empty-state h3 {
    font-size: 1.25rem;
    margin-bottom: var(--space-sm);
  }

  .empty-state p {
    color: var(--color-text-muted);
    margin-bottom: var(--space-lg);
    max-width: 300px;
    margin-left: auto;
    margin-right: auto;
  }

  /* Routines Section */
  .routines-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--space-xl);
    gap: var(--space-md);
    flex-wrap: wrap;
  }

  .routine-select {
    padding: var(--space-sm) var(--space-md);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    background: var(--color-bg-card);
    font-size: 1rem;
    color: var(--color-text);
    min-width: 200px;
  }

  .routine-description {
    color: var(--color-text-muted);
    margin-bottom: var(--space-xl);
  }

  .days-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: var(--space-lg);
  }

  .day-card {
    background: var(--color-bg-card);
    border-radius: var(--radius-lg);
    padding: var(--space-lg);
    box-shadow: var(--shadow-sm);
    border: 1px solid var(--color-border-light);
  }

  .day-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: var(--space-lg);
    padding-bottom: var(--space-md);
    border-bottom: 1px solid var(--color-border-light);
  }

  .day-info {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
  }

  .day-select {
    padding: var(--space-xs) var(--space-sm);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    background: var(--color-bg);
    font-size: 0.8rem;
    color: var(--color-text-muted);
    width: fit-content;
  }

  .day-name-input {
    font-size: 1.125rem;
    font-weight: 600;
    font-family: var(--font-display);
    border: none;
    background: transparent;
    color: var(--color-text);
    padding: 0;
  }

  .day-name-input:focus {
    outline: none;
    border-bottom: 2px solid var(--color-primary);
  }

  .icon-btn {
    padding: var(--space-xs);
    border-radius: var(--radius-sm);
    color: var(--color-text-muted);
    transition: all var(--transition-fast);
  }

  .icon-btn:hover {
    background: var(--color-bg-hover);
    color: var(--color-text);
  }

  .icon-btn.delete:hover {
    background: var(--color-danger-light);
    color: var(--color-danger);
  }

  .icon-btn.small {
    padding: 2px;
  }

  .day-exercises {
    display: flex;
    flex-direction: column;
    gap: var(--space-md);
  }

  .exercise-edit-item {
    padding: var(--space-sm);
    background: var(--color-bg);
    border-radius: var(--radius-sm);
    border: 1px solid var(--color-border-light);
  }

  .exercise-edit-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--space-sm);
  }

  .exercise-name-input {
    font-weight: 500;
    border: none;
    background: transparent;
    color: var(--color-text);
    font-size: 0.95rem;
    width: 100%;
    padding: 0;
  }

  .exercise-name-input:focus {
    outline: none;
    border-bottom: 1px solid var(--color-primary);
  }

  .exercise-edit-details {
    display: flex;
    gap: var(--space-sm);
    flex-wrap: wrap;
  }

  .detail-input-group {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .detail-input-group label {
    font-size: 0.7rem;
    color: var(--color-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .detail-input-group input {
    width: 70px;
    padding: var(--space-xs);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    font-size: 0.85rem;
    background: var(--color-bg-card);
  }

  .detail-input-group input:focus {
    outline: none;
    border-color: var(--color-primary);
  }

  .weight-group {
    flex: 1;
    min-width: 140px;
  }

  .weight-group label {
    color: var(--color-warning);
    font-weight: 600;
  }

  .weight-controls {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .weight-input {
    flex: 1;
    text-align: center;
    font-weight: 600;
    color: var(--color-text);
  }

  .weight-btn {
    width: 32px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--radius-sm);
    font-size: 0.75rem;
    font-weight: 600;
    transition: all var(--transition-fast);
  }

  .weight-btn.minus {
    background: var(--color-danger-light);
    color: var(--color-danger);
  }

  .weight-btn.minus:hover {
    background: var(--color-danger);
    color: white;
  }

  .weight-btn.plus {
    background: var(--color-success-light);
    color: var(--color-success);
  }

  .weight-btn.plus:hover {
    background: var(--color-success);
    color: white;
  }

  .add-exercise-btn {
    padding: var(--space-sm);
    border: 1px dashed var(--color-border);
    border-radius: var(--radius-sm);
    color: var(--color-text-muted);
    font-size: 0.875rem;
    transition: all var(--transition-fast);
  }

  .add-exercise-btn:hover {
    border-color: var(--color-primary);
    color: var(--color-primary);
    background: rgba(var(--color-primary-rgb), 0.05);
  }

  .add-day-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--space-sm);
    min-height: 200px;
    border: 2px dashed var(--color-border);
    border-radius: var(--radius-lg);
    color: var(--color-text-muted);
    transition: all var(--transition-fast);
  }

  .add-day-card:hover {
    border-color: var(--color-primary);
    color: var(--color-primary);
    background: rgba(var(--color-primary-rgb), 0.05);
  }

  /* Modal */
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
    padding: var(--space-lg);
  }

  .modal {
    background: var(--color-bg-card);
    border-radius: var(--radius-xl);
    padding: var(--space-xl);
    max-width: 500px;
    width: 100%;
    box-shadow: var(--shadow-lg);
  }

  .modal h2 {
    margin-bottom: var(--space-xl);
  }

  .form-group {
    margin-bottom: var(--space-lg);
  }

  .form-group label {
    display: block;
    margin-bottom: var(--space-sm);
    font-weight: 500;
    color: var(--color-text);
  }

  .form-group input,
  .form-group textarea {
    width: 100%;
    padding: var(--space-sm) var(--space-md);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    font-size: 1rem;
    background: var(--color-bg);
  }

  .form-group input:focus,
  .form-group textarea:focus {
    outline: none;
    border-color: var(--color-primary);
  }

  .modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--space-md);
    margin-top: var(--space-xl);
  }

  /* Mobile Responsiveness */
  @media (max-width: 600px) {
    .page-header h1 {
      font-size: 2rem;
    }

    .tabs {
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
    }

    .tab {
      padding: var(--space-sm) var(--space-md);
      white-space: nowrap;
    }

    .workout-header {
      flex-direction: column;
      gap: var(--space-md);
    }

    .routines-header {
      flex-direction: column;
      align-items: stretch;
    }

    .routine-select {
      width: 100%;
    }

    .days-grid {
      grid-template-columns: 1fr;
    }

    .exercise-main {
      flex-direction: column;
      align-items: flex-start;
    }

    .exercise-edit-details {
      flex-direction: column;
    }

    .detail-input-group input {
      width: 100%;
    }

    .weight-group {
      min-width: 100%;
    }

    .weight-controls {
      width: 100%;
    }

    .weight-btn {
      width: 40px;
    }
  }

  /* Active Workout Styles */
  .active-badge {
    margin-left: var(--space-xs);
    padding: 2px 6px;
    background: var(--color-success);
    color: white;
    font-size: 0.65rem;
    border-radius: var(--radius-full);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .active-workout {
    border: 2px solid var(--color-primary);
    background: linear-gradient(135deg, var(--color-bg-card) 0%, rgba(var(--color-primary-rgb), 0.05) 100%);
  }

  .session-progress {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: var(--space-xs);
  }

  .progress-text {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--color-text);
  }

  .progress-bar {
    width: 100px;
    height: 8px;
    background: var(--color-border);
    border-radius: var(--radius-full);
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background: var(--color-success);
    border-radius: var(--radius-full);
    transition: width 0.3s ease;
  }

  .start-section {
    display: flex;
    justify-content: center;
    padding: var(--space-lg) 0;
    margin-bottom: var(--space-lg);
    border-bottom: 1px solid var(--color-border-light);
  }

  .start-workout-btn {
    padding: var(--space-md) var(--space-2xl);
    font-size: 1.125rem;
  }

  .btn-large {
    padding: var(--space-md) var(--space-xl);
    font-size: 1rem;
  }

  .exercise-left {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
  }

  .checkbox {
    width: 24px;
    height: 24px;
    border: 2px solid var(--color-border);
    border-radius: var(--radius-sm);
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all var(--transition-fast);
    flex-shrink: 0;
  }

  .checkbox.checked {
    background: var(--color-success);
    border-color: var(--color-success);
    color: white;
  }

  .exercise-item.clickable {
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .exercise-item.clickable:hover {
    background: var(--color-bg-hover);
    border-color: var(--color-primary);
  }

  .exercise-item.completed {
    background: rgba(var(--color-success-rgb, 34, 197, 94), 0.1);
    border-color: var(--color-success);
    position: relative;
  }

  .strikethrough {
    text-decoration: line-through;
    opacity: 0.7;
  }

  .pr-badge {
    display: inline-flex;
    align-items: center;
    padding: 2px 8px;
    background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%);
    color: #78350f;
    font-size: 0.7rem;
    font-weight: 700;
    border-radius: var(--radius-full);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    animation: pulse 2s ease-in-out infinite;
  }

  @keyframes pulse {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.05); }
  }

  .undo-btn {
    position: absolute;
    top: var(--space-sm);
    right: var(--space-sm);
    padding: var(--space-xs);
    border-radius: var(--radius-sm);
    color: var(--color-text-muted);
    opacity: 0;
    transition: all var(--transition-fast);
  }

  .exercise-item.completed:hover .undo-btn {
    opacity: 1;
  }

  .undo-btn:hover {
    background: var(--color-bg-card);
    color: var(--color-text);
  }

  .session-actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--space-md);
    margin-top: var(--space-xl);
    padding-top: var(--space-lg);
    border-top: 1px solid var(--color-border-light);
  }

  /* PR Toast */
  .pr-toast {
    position: fixed;
    top: var(--space-xl);
    right: var(--space-xl);
    z-index: 1000;
    animation: slideIn 0.3s ease;
  }

  @keyframes slideIn {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }

  .pr-toast-content {
    display: flex;
    align-items: center;
    gap: var(--space-md);
    padding: var(--space-md) var(--space-lg);
    background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
    border: 2px solid #f59e0b;
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-lg);
  }

  .pr-icon {
    font-size: 1.5rem;
  }

  .pr-text {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .pr-text strong {
    color: #92400e;
    font-size: 0.875rem;
  }

  .pr-text span {
    color: #78350f;
    font-size: 0.8rem;
  }

  /* Progress Section */
  .progress-section {
    padding: var(--space-xl);
  }

  .progress-placeholder {
    text-align: center;
    padding: var(--space-2xl);
    background: var(--color-bg-card);
    border-radius: var(--radius-xl);
    border: 2px dashed var(--color-border);
  }

  .progress-note {
    font-size: 0.875rem;
    color: var(--color-text-muted);
    font-style: italic;
    margin-top: var(--space-md);
  }

  /* Mobile adjustments for session UI */
  @media (max-width: 600px) {
    .exercise-left {
      flex-wrap: wrap;
    }

    .session-actions {
      flex-direction: column;
    }

    .session-actions .btn {
      width: 100%;
    }

    .pr-toast {
      top: auto;
      bottom: var(--space-xl);
      left: var(--space-md);
      right: var(--space-md);
    }
  }
</style>
