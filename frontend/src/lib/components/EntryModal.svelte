<script lang="ts">
  import { entries, entriesByDate } from '$lib/stores/entries';
  import { issueTypes } from '$lib/stores/issueTypes';
  import { selectedDate, closeModal, showToast } from '$lib/stores/ui';
  import { api, type HealthIssue, type WorkoutDay } from '$lib/api';
  import { onMount } from 'svelte';
  import StressSlider from './StressSlider.svelte';
  import WorkoutToggle from './WorkoutToggle.svelte';
  import WorkoutTypeSelector from './WorkoutTypeSelector.svelte';
  import IssueSelector from './IssueSelector.svelte';

  let date = $derived($selectedDate);
  let existingEntry = $derived(date ? $entriesByDate.get(date) : undefined);
  let isEditing = $derived(!!existingEntry);

  let stressLevel = $state<number | null>(null);
  let workedOut = $state(false);
  let workoutType = $state<string | null>(null);
  let workoutNotes = $state('');
  let notes = $state('');
  let healthIssues = $state<HealthIssue[]>([]);
  let saving = $state(false);
  let routineDays = $state<WorkoutDay[]>([]);

  // Fetch workout routines on mount
  onMount(async () => {
    try {
      const routines = await api.getWorkoutRoutines();
      // Get all days from all routines (or just active one)
      const activeRoutine = routines.find(r => r.is_active) || routines[0];
      if (activeRoutine) {
        routineDays = activeRoutine.days;
      }
    } catch (e) {
      console.error('Failed to load routines:', e);
    }
  });

  // Reset form when date changes
  $effect(() => {
    if (date) {
      if (existingEntry) {
        stressLevel = existingEntry.stress_level;
        workedOut = existingEntry.worked_out;
        workoutType = existingEntry.workout_type || null;
        workoutNotes = existingEntry.workout_notes || '';
        notes = existingEntry.notes || '';
        healthIssues = existingEntry.health_issues.map(i => ({ ...i }));
      } else {
        stressLevel = null;
        workedOut = false;
        workoutType = null;
        workoutNotes = '';
        notes = '';
        healthIssues = [];
      }
    }
  });

  function formatDisplayDate(dateStr: string | null): string {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  async function handleSave() {
    if (!date) return;

    saving = true;
    try {
      const entryData = {
        date,
        stress_level: stressLevel,
        worked_out: workedOut,
        workout_type: workedOut ? workoutType : null,
        workout_notes: workoutNotes || null,
        notes: notes || null,
        health_issues: healthIssues.map(({ issue_type, severity, notes, time_of_day }) => ({
          issue_type,
          severity,
          notes,
          time_of_day
        }))
      };

      if (isEditing) {
        await entries.update(date, entryData);
        showToast('Entry updated successfully', 'success');
      } else {
        await entries.create(entryData);
        showToast('Entry created successfully', 'success');
      }
      closeModal();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Failed to save entry', 'error');
    } finally {
      saving = false;
    }
  }

  async function handleDelete() {
    if (!date || !confirm('Are you sure you want to delete this entry?')) return;

    saving = true;
    try {
      await entries.delete(date);
      showToast('Entry deleted', 'success');
      closeModal();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Failed to delete entry', 'error');
    } finally {
      saving = false;
    }
  }

  function handleBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget) {
      closeModal();
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      closeModal();
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_noninteractive_element_interactions -->
<div class="modal-backdrop" onclick={handleBackdropClick} role="dialog" aria-modal="true" aria-label="Entry form dialog">
  <div class="modal animate-slide-up">
    <header class="modal-header">
      <div>
        <h2>{isEditing ? 'Edit Entry' : 'New Entry'}</h2>
        <p class="date-display">{formatDisplayDate(date)}</p>
      </div>
      <button class="close-btn" onclick={closeModal} aria-label="Close">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M18 6L6 18M6 6l12 12"/>
        </svg>
      </button>
    </header>

    <div class="modal-body">
      <section class="form-section">
        <h3>How stressed were you today?</h3>
        <StressSlider bind:value={stressLevel} />
      </section>

      <section class="form-section">
        <h3>Did you work out?</h3>
        <WorkoutToggle bind:checked={workedOut} />
        {#if workedOut}
          <div class="workout-details animate-slide-up">
            <h4>What type of workout?</h4>
            <WorkoutTypeSelector bind:value={workoutType} {routineDays} />
            <textarea
              bind:value={workoutNotes}
              placeholder="Additional notes (optional)"
              rows="2"
            ></textarea>
          </div>
        {/if}
      </section>

      <section class="form-section">
        <h3>Any health issues?</h3>
        <IssueSelector
          bind:issues={healthIssues}
          issueTypes={$issueTypes}
        />
      </section>

      <section class="form-section">
        <h3>Notes</h3>
        <textarea
          bind:value={notes}
          placeholder="Any other thoughts about your day..."
          rows="3"
        ></textarea>
      </section>
    </div>

    <footer class="modal-footer">
      {#if isEditing}
        <button class="btn btn-danger" onclick={handleDelete} disabled={saving}>
          Delete
        </button>
      {/if}
      <div class="footer-right">
        <button class="btn btn-secondary" onclick={closeModal} disabled={saving}>
          Cancel
        </button>
        <button class="btn btn-primary" onclick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : (isEditing ? 'Update' : 'Save')}
        </button>
      </div>
    </footer>
  </div>
</div>

<style>
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(61, 54, 48, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--space-lg);
    z-index: 100;
    backdrop-filter: blur(4px);
  }

  .modal {
    background: var(--color-bg-card);
    border-radius: var(--radius-xl);
    width: 100%;
    max-width: 560px;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    box-shadow: var(--shadow-lg);
  }

  .modal-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    padding: var(--space-xl);
    border-bottom: 1px solid var(--color-border-light);
  }

  .modal-header h2 {
    margin: 0;
    font-size: 1.5rem;
  }

  .date-display {
    color: var(--color-text-muted);
    font-size: 0.875rem;
    margin-top: var(--space-xs);
  }

  .close-btn {
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--radius-full);
    color: var(--color-text-muted);
    transition: all var(--transition-fast);
  }

  .close-btn:hover {
    background: var(--color-bg-hover);
    color: var(--color-text);
  }

  .modal-body {
    flex: 1;
    overflow-y: auto;
    padding: var(--space-xl);
    display: flex;
    flex-direction: column;
    gap: var(--space-xl);
  }

  .form-section h3 {
    font-size: 1rem;
    font-weight: 600;
    margin-bottom: var(--space-md);
    color: var(--color-text);
  }

  textarea {
    width: 100%;
    padding: var(--space-md);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    resize: vertical;
    font-size: 0.95rem;
    transition: border-color var(--transition-fast);
    background: var(--color-bg);
  }

  textarea:focus {
    outline: none;
    border-color: var(--color-primary);
  }

  .workout-details {
    margin-top: var(--space-md);
    display: flex;
    flex-direction: column;
    gap: var(--space-md);
  }

  .workout-details h4 {
    font-size: 0.9rem;
    font-weight: 500;
    color: var(--color-text-muted);
    margin: 0;
  }

  .modal-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-lg) var(--space-xl);
    border-top: 1px solid var(--color-border-light);
    gap: var(--space-md);
  }

  .footer-right {
    display: flex;
    gap: var(--space-sm);
    margin-left: auto;
  }

  .btn-danger {
    background: var(--color-danger-light);
    color: var(--color-danger);
  }

  .btn-danger:hover {
    background: var(--color-danger);
    color: white;
  }
</style>
