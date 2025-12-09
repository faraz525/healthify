<script lang="ts">
  import { api, type WorkoutRoutine, type WorkoutDay, type Exercise } from '$lib/api';
  import { onMount } from 'svelte';

  let routines = $state<WorkoutRoutine[]>([]);
  let selectedRoutine = $state<WorkoutRoutine | null>(null);
  let todaysWorkout = $state<WorkoutDay | null>(null);
  let loading = $state(true);
  let activeTab = $state<'today' | 'routines'>('today');
  let showCreateModal = $state(false);
  let showEditModal = $state(false);
  let editingDay = $state<WorkoutDay | null>(null);

  const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  onMount(async () => {
    await loadData();
  });

  async function loadData() {
    loading = true;
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
      await loadData();
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
      await loadData();
    } catch (e) {
      console.error('Failed to add exercise:', e);
    }
  }

  async function handleUpdateExercise(exerciseId: number, field: string, value: string | number | null) {
    try {
      await api.updateExercise(exerciseId, { [field]: value });
      await loadData();
    } catch (e) {
      console.error('Failed to update exercise:', e);
    }
  }

  async function handleDeleteExercise(exerciseId: number) {
    try {
      await api.deleteExercise(exerciseId);
      await loadData();
    } catch (e) {
      console.error('Failed to delete exercise:', e);
    }
  }

  async function handleUpdateDay(dayId: number, field: string, value: string | number | null) {
    try {
      await api.updateWorkoutDay(dayId, { [field]: value });
      await loadData();
    } catch (e) {
      console.error('Failed to update day:', e);
    }
  }

  async function handleDeleteDay(dayId: number) {
    try {
      await api.deleteWorkoutDay(dayId);
      await loadData();
    } catch (e) {
      console.error('Failed to delete day:', e);
    }
  }

  function openEditDay(day: WorkoutDay) {
    editingDay = { ...day };
    showEditModal = true;
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
        {#if todaysWorkout}
          <div class="workout-card today-workout">
            <div class="workout-header">
              <div class="workout-title">
                <span class="day-badge">{getDayName(todaysWorkout.day_of_week)}</span>
                <h2>{todaysWorkout.name}</h2>
              </div>
              <span class="exercise-count">{todaysWorkout.exercises.length} exercises</span>
            </div>

            <div class="exercises-list">
              {#each todaysWorkout.exercises.sort((a, b) => a.sort_order - b.sort_order) as exercise}
                <div class="exercise-item">
                  <div class="exercise-main">
                    <span class="exercise-name">{exercise.name}</span>
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
                  {#if exercise.rest_seconds || exercise.notes}
                    <div class="exercise-meta">
                      {#if exercise.rest_seconds}
                        <span class="rest-time">{formatRestTime(exercise.rest_seconds)}</span>
                      {/if}
                      {#if exercise.notes}
                        <span class="exercise-notes">{exercise.notes}</span>
                      {/if}
                    </div>
                  {/if}
                </div>
              {/each}
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
                {#each selectedRoutine.days.sort((a, b) => a.sort_order - b.sort_order) as day}
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
                      {#each day.exercises.sort((a, b) => a.sort_order - b.sort_order) as exercise}
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
                            <div class="detail-input-group">
                              <label>Weight</label>
                              <input
                                type="text"
                                value={exercise.target_weight ?? ''}
                                placeholder="135 lbs"
                                onblur={(e) => handleUpdateExercise(exercise.id!, 'target_weight', (e.target as HTMLInputElement).value || null)}
                              />
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
  {/if}
</div>

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
  }
</style>
