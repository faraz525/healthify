<script lang="ts">
  import { enhance } from '$app/forms';
  import { invalidateAll } from '$app/navigation';

  interface Exercise {
    id?: number;
    name: string;
    targetSets?: number | null;
    targetReps?: string | null;
    targetWeight?: string | null;
    restSeconds?: number | null;
    notes?: string | null;
    sortOrder: number;
  }

  interface WorkoutDay {
    id?: number;
    name: string;
    dayOfWeek?: number | null;
    sortOrder: number;
    exercises: Exercise[];
  }

  interface WorkoutRoutine {
    id?: number;
    name: string;
    description?: string | null;
    isActive?: boolean | null;
    days: WorkoutDay[];
  }

  interface WorkoutSession {
    id: number;
    workoutDayId: number;
    status: string;
    startedAt: string;
    completedAt?: string | null;
    notes?: string | null;
    workoutDay?: WorkoutDay;
  }

  interface ExerciseLog {
    id: number;
    setNumber: number;
    weight: string | null;
    reps: number | null;
    isPR: boolean;
  }

  interface SessionPR {
    exerciseId: number;
    exerciseName: string;
    weight: string | null;
    reps: number | null;
  }

  interface PreviousBest {
    weight: string;
    reps: number;
  }

  let { data } = $props<{
    data: {
      routines: WorkoutRoutine[];
      todaysWorkout: WorkoutDay | null;
      activeSession: WorkoutSession | null;
      sessionLogs: Record<number, ExerciseLog[]>;
      sessionPRs: SessionPR[];
      exercisePreviousBests: Record<number, PreviousBest | null>;
    }
  }>();

  let routines = $derived(data.routines);
  let todaysWorkout = $derived(data.todaysWorkout);
  let activeSession = $derived(data.activeSession);
  let sessionLogs = $derived(data.sessionLogs);
  let sessionPRs = $derived(data.sessionPRs);
  let exercisePreviousBests = $derived(data.exercisePreviousBests);
  let selectedRoutine = $state<WorkoutRoutine | null>(null);
  let activeTab = $state<'today' | 'routines'>('today');
  let showCreateModal = $state(false);
  let showPRToast = $state(false);
  let lastPR = $state<{ exerciseName: string; weight: string | null; reps: number | null } | null>(null);
  let toastTimeout: ReturnType<typeof setTimeout> | null = null;

  const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  $effect(() => {
    if (routines.length > 0 && !selectedRoutine) {
      selectedRoutine = routines.find((r: WorkoutRoutine) => r.isActive) || routines[0];
    }
  });

  function getDayName(dayOfWeek: number | null | undefined): string {
    if (dayOfWeek === null || dayOfWeek === undefined) return 'Flexible';
    return dayNames[dayOfWeek];
  }

  function formatRestTime(seconds: number | null | undefined): string {
    if (!seconds) return '';
    if (seconds < 60) return `${seconds}s rest`;
    return `${Math.floor(seconds / 60)}m rest`;
  }

  async function handleAddDay() {
    if (!selectedRoutine?.id) return;

    const formData = new FormData();
    formData.set('routineId', selectedRoutine.id.toString());
    formData.set('data', JSON.stringify({
      name: 'New Day',
      dayOfWeek: null,
      sortOrder: selectedRoutine.days.length
    }));

    await fetch('?/createDay', { method: 'POST', body: formData });
    await invalidateAll();
  }

  async function handleAddExercise(dayId: number) {
    const formData = new FormData();
    formData.set('dayId', dayId.toString());
    formData.set('data', JSON.stringify({
      name: 'New Exercise',
      targetSets: 3,
      targetReps: '8-12',
      targetWeight: null,
      restSeconds: 90,
      sortOrder: 0
    }));

    await fetch('?/createExercise', { method: 'POST', body: formData });
    await invalidateAll();
  }

  async function handleUpdateExercise(exerciseId: number, field: string, value: string | number | null) {
    const formData = new FormData();
    formData.set('exerciseId', exerciseId.toString());
    formData.set('data', JSON.stringify({ [field]: value }));

    await fetch('?/updateExercise', { method: 'POST', body: formData });
    await invalidateAll();
  }

  function adjustWeight(exercise: Exercise, delta: number) {
    const currentWeight = exercise.targetWeight || '0';
    const match = currentWeight.match(/^(\d+(?:\.\d+)?)/);
    const numericWeight = match ? parseFloat(match[1]) : 0;
    const newWeight = Math.max(0, numericWeight + delta);
    const unitMatch = currentWeight.match(/\s+([a-zA-Z]+)$/);
    const unit = unitMatch ? unitMatch[1] : '';
    const newWeightStr = newWeight > 0 ? (unit ? `${newWeight} ${unit}` : `${newWeight}`) : null;
    if (exercise.id) {
      handleUpdateExercise(exercise.id, 'targetWeight', newWeightStr);
    }
  }

  async function handleDeleteExercise(exerciseId: number) {
    const formData = new FormData();
    formData.set('exerciseId', exerciseId.toString());

    await fetch('?/deleteExercise', { method: 'POST', body: formData });
    await invalidateAll();
  }

  async function handleUpdateDay(dayId: number, field: string, value: string | number | null) {
    const formData = new FormData();
    formData.set('dayId', dayId.toString());
    formData.set('data', JSON.stringify({ [field]: value }));

    await fetch('?/updateDay', { method: 'POST', body: formData });
    await invalidateAll();
  }

  async function handleDeleteDay(dayId: number) {
    const formData = new FormData();
    formData.set('dayId', dayId.toString());

    await fetch('?/deleteDay', { method: 'POST', body: formData });
    await invalidateAll();
  }

  // Session management functions
  async function handleStartSession(workoutDayId: number) {
    const formData = new FormData();
    formData.set('workoutDayId', workoutDayId.toString());

    await fetch('?/startSession', { method: 'POST', body: formData });
    await invalidateAll();
  }

  async function handleLogSet(exerciseId: number, exerciseName: string, setNumber: number, weight: string, reps: number) {
    if (!activeSession) return;

    const formData = new FormData();
    formData.set('sessionId', activeSession.id.toString());
    formData.set('exerciseId', exerciseId.toString());
    formData.set('setNumber', setNumber.toString());
    formData.set('weight', weight);
    formData.set('reps', reps.toString());

    const response = await fetch('?/logSet', { method: 'POST', body: formData });
    const result = await response.json();

    // Show PR toast if this was a new PR
    if (result.data?.isPR) {
      showPRNotification(exerciseName, weight, reps);
    }

    await invalidateAll();
  }

  async function handleUpdateLog(logId: number, exerciseName: string, weight: string, reps: number) {
    const formData = new FormData();
    formData.set('logId', logId.toString());
    formData.set('weight', weight);
    formData.set('reps', reps.toString());

    const response = await fetch('?/updateLog', { method: 'POST', body: formData });
    const result = await response.json();

    if (result.data?.isPR) {
      showPRNotification(exerciseName, weight, reps);
    }

    await invalidateAll();
  }

  async function handleDeleteLog(logId: number) {
    const formData = new FormData();
    formData.set('logId', logId.toString());

    await fetch('?/deleteLog', { method: 'POST', body: formData });
    await invalidateAll();
  }

  async function handleCompleteSession() {
    if (!activeSession) return;

    const formData = new FormData();
    formData.set('sessionId', activeSession.id.toString());

    await fetch('?/completeSession', { method: 'POST', body: formData });
    await invalidateAll();
  }

  async function handleCancelSession() {
    if (!activeSession) return;

    const formData = new FormData();
    formData.set('sessionId', activeSession.id.toString());

    await fetch('?/cancelSession', { method: 'POST', body: formData });
    await invalidateAll();
  }

  function showPRNotification(exerciseName: string, weight: string | null, reps: number | null) {
    lastPR = { exerciseName, weight, reps };
    showPRToast = true;

    if (toastTimeout) clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
      showPRToast = false;
    }, 4000);
  }

  function getNextSetNumber(exerciseId: number): number {
    const logs = sessionLogs[exerciseId] || [];
    if (logs.length === 0) return 1;
    return Math.max(...logs.map((l: ExerciseLog) => l.setNumber)) + 1;
  }

  function isExerciseComplete(exerciseId: number, targetSets: number | null | undefined): boolean {
    const logs = sessionLogs[exerciseId] || [];
    if (!targetSets) return logs.length > 0;
    return logs.length >= targetSets;
  }

  function getSessionDuration(): string {
    if (!activeSession) return '';
    const start = new Date(activeSession.startedAt);
    const now = new Date();
    const diffMs = now.getTime() - start.getTime();
    const minutes = Math.floor(diffMs / 60000);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m`;
  }
</script>

<div class="container">
  <div class="page-header">
    <h1>Workouts</h1>
    <p class="subtitle">Your gym routines and exercises</p>
  </div>

  <div class="tabs">
    <button
      class="tab"
      class:active={activeTab === 'today'}
      onclick={() => activeTab = 'today'}
    >
      Today's Workout
    </button>
    <button
      class="tab"
      class:active={activeTab === 'routines'}
      onclick={() => activeTab = 'routines'}
    >
      My Routines
    </button>
  </div>

  {#if activeTab === 'today'}
    <div class="today-section">
      {#if activeSession}
        <!-- Active workout session -->
        <div class="workout-card today-workout session-active">
          <div class="workout-header">
            <div class="workout-title">
              <span class="session-badge">WORKOUT IN PROGRESS</span>
              <h2>{activeSession.workoutDay?.name ?? 'Workout'}</h2>
            </div>
            <div class="session-info">
              <span class="session-duration">{getSessionDuration()}</span>
              <div class="session-actions">
                <button class="btn btn-secondary btn-sm" onclick={handleCancelSession}>
                  Cancel
                </button>
                <button class="btn btn-primary btn-sm" onclick={handleCompleteSession}>
                  Complete Workout
                </button>
              </div>
            </div>
          </div>

          {#if sessionPRs.length > 0}
            <div class="pr-summary">
              <span class="pr-icon">PR</span>
              <span>You've hit {sessionPRs.length} PR{sessionPRs.length > 1 ? 's' : ''} this session!</span>
            </div>
          {/if}

          <div class="exercises-list session-exercises">
            {#each [...(activeSession.workoutDay?.exercises ?? [])].sort((a, b) => a.sortOrder - b.sortOrder) as exercise}
              {@const exerciseLogs = sessionLogs[exercise.id!] || []}
              {@const isComplete = isExerciseComplete(exercise.id!, exercise.targetSets)}
              {@const previousBest = exercisePreviousBests[exercise.id!]}
              {@const hasPR = exerciseLogs.some((l: ExerciseLog) => l.isPR)}
              <div class="exercise-item session-exercise" class:complete={isComplete}>
                <div class="exercise-main">
                  <div class="exercise-name-row">
                    {#if isComplete}
                      <span class="check-icon">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                      </span>
                    {/if}
                    <span class="exercise-name" class:complete={isComplete}>{exercise.name}</span>
                    {#if hasPR}
                      <span class="pr-badge">PR</span>
                    {/if}
                  </div>
                  <div class="exercise-details">
                    {#if exercise.targetSets}
                      <span class="detail-badge sets">{exerciseLogs.length}/{exercise.targetSets} sets</span>
                    {/if}
                    {#if exercise.targetReps}
                      <span class="detail-badge reps">{exercise.targetReps} reps</span>
                    {/if}
                    {#if exercise.targetWeight}
                      <span class="detail-badge weight">{exercise.targetWeight}</span>
                    {/if}
                  </div>
                </div>

                {#if previousBest}
                  <div class="previous-best">
                    Best: {previousBest.weight} x {previousBest.reps} reps
                  </div>
                {/if}

                <!-- Logged sets -->
                {#if exerciseLogs.length > 0}
                  <div class="logged-sets">
                    {#each exerciseLogs as log}
                      <div class="logged-set" class:is-pr={log.isPR}>
                        <span class="set-number">Set {log.setNumber}</span>
                        <span class="set-details">{log.weight ?? '-'} x {log.reps ?? '-'}</span>
                        {#if log.isPR}
                          <span class="set-pr-badge">PR</span>
                        {/if}
                        <button class="icon-btn delete small" onclick={() => handleDeleteLog(log.id)} title="Delete set">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M18 6L6 18M6 6l12 12"/>
                          </svg>
                        </button>
                      </div>
                    {/each}
                  </div>
                {/if}

                <!-- Log new set form -->
                {#if !isComplete || !exercise.targetSets}
                  <form class="log-set-form" onsubmit={(e) => {
                    e.preventDefault();
                    const form = e.target as HTMLFormElement;
                    const weight = (form.elements.namedItem('weight') as HTMLInputElement).value;
                    const reps = parseInt((form.elements.namedItem('reps') as HTMLInputElement).value);
                    if (reps) {
                      handleLogSet(exercise.id!, exercise.name, getNextSetNumber(exercise.id!), weight, reps);
                      form.reset();
                      // Pre-fill weight from last set or target
                      const weightInput = form.elements.namedItem('weight') as HTMLInputElement;
                      if (exerciseLogs.length > 0 && exerciseLogs[exerciseLogs.length - 1].weight) {
                        weightInput.value = exerciseLogs[exerciseLogs.length - 1].weight!;
                      } else if (exercise.targetWeight) {
                        weightInput.value = exercise.targetWeight;
                      }
                    }
                  }}>
                    <span class="set-label">Set {getNextSetNumber(exercise.id!)}</span>
                    <input
                      type="text"
                      name="weight"
                      placeholder="Weight"
                      class="set-input weight"
                      value={exerciseLogs.length > 0 && exerciseLogs[exerciseLogs.length - 1].weight ? exerciseLogs[exerciseLogs.length - 1].weight : (exercise.targetWeight ?? '')}
                    />
                    <input
                      type="number"
                      name="reps"
                      placeholder="Reps"
                      class="set-input reps"
                      min="1"
                    />
                    <button type="submit" class="btn btn-primary btn-sm">Log</button>
                  </form>
                {/if}
              </div>
            {/each}
          </div>
        </div>
      {:else if todaysWorkout}
        <div class="workout-card today-workout">
          <div class="workout-header">
            <div class="workout-title">
              <span class="day-badge">{getDayName(todaysWorkout.dayOfWeek)}</span>
              <h2>{todaysWorkout.name}</h2>
            </div>
            <span class="exercise-count">{todaysWorkout.exercises.length} exercises</span>
          </div>

          <div class="exercises-list">
            {#each [...todaysWorkout.exercises].sort((a, b) => a.sortOrder - b.sortOrder) as exercise}
              <div class="exercise-item">
                <div class="exercise-main">
                  <span class="exercise-name">{exercise.name}</span>
                  <div class="exercise-details">
                    {#if exercise.targetSets}
                      <span class="detail-badge sets">{exercise.targetSets} sets</span>
                    {/if}
                    {#if exercise.targetReps}
                      <span class="detail-badge reps">{exercise.targetReps} reps</span>
                    {/if}
                    {#if exercise.targetWeight}
                      <span class="detail-badge weight">{exercise.targetWeight}</span>
                    {/if}
                  </div>
                </div>
                {#if exercise.restSeconds || exercise.notes}
                  <div class="exercise-meta">
                    {#if exercise.restSeconds}
                      <span class="rest-time">{formatRestTime(exercise.restSeconds)}</span>
                    {/if}
                    {#if exercise.notes}
                      <span class="exercise-notes">{exercise.notes}</span>
                    {/if}
                  </div>
                {/if}
              </div>
            {/each}
          </div>

          <div class="start-workout-section">
            <button class="btn btn-primary btn-lg" onclick={() => handleStartSession(todaysWorkout.id!)}>
              Start Workout
            </button>
          </div>
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
              selectedRoutine = routines.find((r: WorkoutRoutine) => r.id === id) || null;
            }}
          >
            {#each routines as routine}
              <option value={routine.id} selected={routine.id === selectedRoutine?.id}>
                {routine.name} {routine.isActive ? '(Active)' : ''}
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
              {#each [...selectedRoutine.days].sort((a, b) => a.sortOrder - b.sortOrder) as day}
                <div class="day-card">
                  <div class="day-header">
                    <div class="day-info">
                      <select
                        class="day-select"
                        value={day.dayOfWeek ?? ''}
                        onchange={(e) => {
                          const val = (e.target as HTMLSelectElement).value;
                          handleUpdateDay(day.id!, 'dayOfWeek', val === '' ? null : parseInt(val));
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
                    {#each [...day.exercises].sort((a, b) => a.sortOrder - b.sortOrder) as exercise}
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
                              value={exercise.targetSets ?? ''}
                              onblur={(e) => handleUpdateExercise(exercise.id!, 'targetSets', parseInt((e.target as HTMLInputElement).value) || null)}
                            />
                          </div>
                          <div class="detail-input-group">
                            <label>Reps</label>
                            <input
                              type="text"
                              value={exercise.targetReps ?? ''}
                              placeholder="8-12"
                              onblur={(e) => handleUpdateExercise(exercise.id!, 'targetReps', (e.target as HTMLInputElement).value || null)}
                            />
                          </div>
                          <div class="detail-input-group weight-group">
                            <label>Weight</label>
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
                                value={exercise.targetWeight ?? ''}
                                placeholder="135 lbs"
                                onblur={(e) => handleUpdateExercise(exercise.id!, 'targetWeight', (e.target as HTMLInputElement).value || null)}
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
  {/if}
</div>

{#if showCreateModal}
  <div class="modal-overlay" onclick={() => showCreateModal = false}>
    <div class="modal" onclick={(e) => e.stopPropagation()}>
      <h2>Create Workout Routine</h2>
      <form method="POST" action="?/createRoutine" use:enhance={() => {
        return async ({ update }) => {
          await update();
          showCreateModal = false;
        };
      }}>
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

<!-- PR Toast Notification -->
{#if showPRToast && lastPR}
  <div class="pr-toast">
    <div class="pr-toast-content">
      <span class="pr-toast-icon">PR</span>
      <div class="pr-toast-text">
        <strong>New Personal Record!</strong>
        <span>{lastPR.exerciseName}: {lastPR.weight} x {lastPR.reps} reps</span>
      </div>
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

  /* Session-specific styles */
  .session-active {
    border: 2px solid var(--color-primary);
  }

  .session-badge {
    display: inline-block;
    padding: var(--space-xs) var(--space-sm);
    background: var(--color-primary);
    color: white;
    border-radius: var(--radius-full);
    font-size: 0.7rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    animation: pulse 2s infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.7; }
  }

  .session-info {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: var(--space-sm);
  }

  .session-duration {
    font-size: 0.875rem;
    color: var(--color-text-muted);
    font-weight: 500;
  }

  .session-actions {
    display: flex;
    gap: var(--space-sm);
  }

  .btn-sm {
    padding: var(--space-xs) var(--space-sm);
    font-size: 0.85rem;
  }

  .btn-lg {
    padding: var(--space-md) var(--space-xl);
    font-size: 1.1rem;
  }

  .pr-summary {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    padding: var(--space-sm) var(--space-md);
    background: linear-gradient(135deg, #FFD700 0%, #FFA500 100%);
    border-radius: var(--radius-md);
    margin-bottom: var(--space-lg);
    color: #1a1a1a;
    font-weight: 600;
  }

  .pr-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    background: #1a1a1a;
    color: #FFD700;
    border-radius: var(--radius-full);
    font-size: 0.7rem;
    font-weight: 800;
  }

  .session-exercise {
    transition: all var(--transition-fast);
  }

  .session-exercise.complete {
    background: rgba(var(--color-success-rgb, 34, 197, 94), 0.05);
    border-color: var(--color-success);
  }

  .exercise-name-row {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
  }

  .check-icon {
    color: var(--color-success);
  }

  .exercise-name.complete {
    text-decoration: line-through;
    color: var(--color-text-muted);
  }

  .pr-badge, .set-pr-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 2px 6px;
    background: linear-gradient(135deg, #FFD700 0%, #FFA500 100%);
    color: #1a1a1a;
    border-radius: var(--radius-sm);
    font-size: 0.65rem;
    font-weight: 800;
    text-transform: uppercase;
  }

  .previous-best {
    font-size: 0.8rem;
    color: var(--color-text-muted);
    margin-top: var(--space-xs);
    font-style: italic;
  }

  .logged-sets {
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
    margin-top: var(--space-md);
    padding-top: var(--space-md);
    border-top: 1px dashed var(--color-border-light);
  }

  .logged-set {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    padding: var(--space-xs) var(--space-sm);
    background: var(--color-bg);
    border-radius: var(--radius-sm);
    font-size: 0.875rem;
  }

  .logged-set.is-pr {
    background: rgba(255, 215, 0, 0.1);
    border: 1px solid rgba(255, 215, 0, 0.3);
  }

  .set-number {
    font-weight: 600;
    color: var(--color-text-muted);
    min-width: 50px;
  }

  .set-details {
    flex: 1;
    font-weight: 500;
  }

  .log-set-form {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    margin-top: var(--space-md);
    padding-top: var(--space-md);
    border-top: 1px solid var(--color-border-light);
  }

  .set-label {
    font-weight: 600;
    color: var(--color-text-muted);
    font-size: 0.875rem;
    min-width: 50px;
  }

  .set-input {
    padding: var(--space-xs) var(--space-sm);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    font-size: 0.9rem;
    background: var(--color-bg-card);
  }

  .set-input.weight {
    width: 100px;
  }

  .set-input.reps {
    width: 70px;
  }

  .set-input:focus {
    outline: none;
    border-color: var(--color-primary);
  }

  .start-workout-section {
    display: flex;
    justify-content: center;
    margin-top: var(--space-xl);
    padding-top: var(--space-xl);
    border-top: 1px solid var(--color-border-light);
  }

  /* PR Toast */
  .pr-toast {
    position: fixed;
    bottom: var(--space-xl);
    left: 50%;
    transform: translateX(-50%);
    z-index: 200;
    animation: slideUp 0.3s ease-out;
  }

  @keyframes slideUp {
    from {
      opacity: 0;
      transform: translateX(-50%) translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateX(-50%) translateY(0);
    }
  }

  .pr-toast-content {
    display: flex;
    align-items: center;
    gap: var(--space-md);
    padding: var(--space-md) var(--space-lg);
    background: linear-gradient(135deg, #FFD700 0%, #FFA500 100%);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-lg);
    color: #1a1a1a;
  }

  .pr-toast-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    background: #1a1a1a;
    color: #FFD700;
    border-radius: var(--radius-full);
    font-size: 0.9rem;
    font-weight: 800;
  }

  .pr-toast-text {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .pr-toast-text strong {
    font-size: 1rem;
  }

  .pr-toast-text span {
    font-size: 0.875rem;
    opacity: 0.9;
  }

  @media (max-width: 600px) {
    .session-info {
      flex-direction: column;
      align-items: stretch;
    }

    .session-actions {
      justify-content: flex-end;
    }

    .log-set-form {
      flex-wrap: wrap;
    }

    .set-label {
      width: 100%;
      margin-bottom: var(--space-xs);
    }

    .set-input.weight,
    .set-input.reps {
      flex: 1;
      min-width: 80px;
    }

    .pr-toast {
      left: var(--space-md);
      right: var(--space-md);
      transform: none;
    }

    @keyframes slideUp {
      from {
        opacity: 0;
        transform: translateY(20px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
  }
</style>
