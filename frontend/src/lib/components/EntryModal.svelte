<script lang="ts">
  import { enhance } from '$app/forms';
  import { invalidateAll } from '$app/navigation';
  import { page } from '$app/stores';
  import { entriesByDate, type DailyEntry } from '$lib/stores/entries';
  import { issueTypes } from '$lib/stores/issueTypes';
  import { selectedDate, closeModal, showToast } from '$lib/stores/ui';
  import StressSlider from './StressSlider.svelte';
  import WorkoutToggle from './WorkoutToggle.svelte';
  import WorkoutTypeSelector from './WorkoutTypeSelector.svelte';
  import IssueSelector from './IssueSelector.svelte';

  // Health issue type for this component
  interface HealthIssue {
    issueType: string;
    severity: number | null;
    notes: string | null;
    timeOfDay: string | null;
  }

  // Workout day type
  interface WorkoutDay {
    id: number;
    name: string;
    dayOfWeek: number | null;
    sortOrder: number;
  }

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
  let healthDetailsExpanded = $state(false);

  // Get workout days from page data - combine days from routines AND standalone workouts
  let routineDays = $derived.by(() => {
    const pageData = $page.data as {
      workoutRoutines?: Array<{ days: WorkoutDay[], isActive: boolean | null }>,
      workouts?: WorkoutDay[]
    };
    const routines = pageData.workoutRoutines || [];
    const standaloneWorkouts = pageData.workouts || [];

    // Combine days from all routines
    const routineDaysList = routines.flatMap(r => r.days || []);

    // Combine with standalone workouts, avoiding duplicates by id
    const routineIds = new Set(routineDaysList.map(d => d.id));
    const uniqueStandalone = standaloneWorkouts.filter(w => !routineIds.has(w.id));

    return [...routineDaysList, ...uniqueStandalone];
  });

  // Reset form when date changes
  $effect(() => {
    if (date) {
      if (existingEntry) {
        stressLevel = existingEntry.stressLevel;
        workedOut = existingEntry.workedOut ?? false;
        workoutType = existingEntry.workoutType || null;
        workoutNotes = existingEntry.workoutNotes || '';
        notes = existingEntry.notes || '';
        const mappedIssues = existingEntry.healthIssues.map(i => ({
          issueType: i.issueType,
          severity: i.severity,
          notes: i.notes,
          timeOfDay: i.timeOfDay
        }));
        healthIssues = mappedIssues;
        // Auto-expand health details if there's existing health data
        // Use existingEntry values directly to avoid reading from state we just set
        healthDetailsExpanded = !!(existingEntry.stressLevel || existingEntry.notes || existingEntry.healthIssues.length > 0);
      } else {
        stressLevel = null;
        workedOut = false;
        workoutType = null;
        workoutNotes = '';
        notes = '';
        healthIssues = [];
        healthDetailsExpanded = false;
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

  function getEntryData() {
    return {
      date,
      stressLevel,
      workedOut,
      workoutType: workedOut ? workoutType : null,
      workoutNotes: workoutNotes || null,
      notes: notes || null,
      healthIssues: healthIssues.map(({ issueType, severity, notes, timeOfDay }) => ({
        issueType,
        severity,
        notes,
        timeOfDay
      }))
    };
  }

  function handleFormResult(result: { type: string; data?: { success?: boolean; error?: string } }) {
    saving = false;
    if (result.type === 'success' || (result.type === 'redirect')) {
      showToast(isEditing ? 'Entry updated successfully' : 'Entry created successfully', 'success');
      invalidateAll();
      closeModal();
    } else if (result.type === 'failure' && result.data?.error) {
      showToast(result.data.error, 'error');
    } else {
      showToast('Failed to save entry', 'error');
    }
  }

  function handleDeleteResult(result: { type: string; data?: { success?: boolean; error?: string } }) {
    saving = false;
    if (result.type === 'success' || (result.type === 'redirect')) {
      showToast('Entry deleted', 'success');
      invalidateAll();
      closeModal();
    } else if (result.type === 'failure' && result.data?.error) {
      showToast(result.data.error, 'error');
    } else {
      showToast('Failed to delete entry', 'error');
    }
  }

  function confirmDelete(): boolean {
    return confirm('Are you sure you want to delete this entry?');
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
<div class="fixed inset-0 bg-[rgba(61,54,48,0.5)] flex items-center justify-center p-6 z-100 backdrop-blur-sm" onclick={handleBackdropClick} role="dialog" aria-modal="true" aria-label="Entry form dialog">
  <div class="bg-(--color-bg-card) rounded-3xl w-full max-w-[560px] max-h-[90vh] flex flex-col shadow-lg animate-slide-up">
    <header class="flex items-start justify-between p-6 border-b border-(--color-border-light)">
      <div>
        <h2 class="m-0 text-2xl font-(family-name:--font-display) font-semibold text-(--color-text)">{isEditing ? 'Edit Entry' : 'New Entry'}</h2>
        <p class="text-(--color-text-muted) text-sm mt-1">{formatDisplayDate(date)}</p>
      </div>
      <button class="w-10 h-10 flex items-center justify-center rounded-full text-(--color-text-muted) transition-all duration-150 hover:bg-(--color-bg-hover) hover:text-(--color-text)" onclick={closeModal} aria-label="Close">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M18 6L6 18M6 6l12 12"/>
        </svg>
      </button>
    </header>

    <div class="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
      <!-- Workout Section (Primary) -->
      <section class="p-5 bg-(--color-primary)/5 rounded-2xl border border-(--color-primary)/15">
        <h3 class="text-base font-semibold mb-4 text-(--color-primary)">Did you work out?</h3>
        <WorkoutToggle bind:checked={workedOut} />
        {#if workedOut}
          <div class="mt-4 flex flex-col gap-4 animate-slide-up">
            <h4 class="text-sm font-medium text-(--color-text-muted) m-0">What type of workout?</h4>
            <WorkoutTypeSelector bind:value={workoutType} {routineDays} />
            <textarea
              bind:value={workoutNotes}
              placeholder="Additional notes (optional)"
              rows="2"
              class="w-full p-4 border border-(--color-border) rounded-xl resize-y text-[0.95rem] transition-colors duration-150 bg-(--color-bg) focus:outline-none focus:border-(--color-primary)"
            ></textarea>
          </div>
        {/if}
      </section>

      <!-- Collapsible Health Details Section -->
      <section class="border border-(--color-border-light) rounded-2xl">
        <button
          type="button"
          class="w-full flex items-center justify-between px-5 py-4 bg-(--color-bg) border-none cursor-pointer transition-colors duration-150 hover:bg-(--color-bg-hover)"
          onclick={() => healthDetailsExpanded = !healthDetailsExpanded}
          aria-expanded={healthDetailsExpanded}
        >
          <span class="flex items-center gap-2 text-base font-semibold text-(--color-text)">
            Health Details
            {#if stressLevel || healthIssues.length > 0 || notes}
              <span class="text-[0.7rem] font-medium px-2 py-0.5 bg-(--color-success-light) text-(--color-success) rounded-full uppercase tracking-wide">Has data</span>
            {/if}
          </span>
          <svg
            class="text-(--color-text-muted) transition-transform duration-150 {healthDetailsExpanded ? 'rotate-180' : ''}"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </button>

        {#if healthDetailsExpanded}
          <div class="p-5 bg-(--color-bg-card) border-t border-(--color-border-light) flex flex-col gap-5 animate-slide-up">
            <div>
              <h4 class="text-sm font-semibold mb-4 text-(--color-text)">How stressed were you today?</h4>
              <StressSlider bind:value={stressLevel} />
            </div>

            <div>
              <h4 class="text-sm font-semibold mb-4 text-(--color-text)">Any health issues?</h4>
              <IssueSelector
                bind:issues={healthIssues}
                issueTypes={$issueTypes}
              />
            </div>

            <div>
              <h4 class="text-sm font-semibold mb-4 text-(--color-text)">Notes</h4>
              <textarea
                bind:value={notes}
                placeholder="Any other thoughts about your day..."
                rows="3"
                class="w-full p-4 border border-(--color-border) rounded-xl resize-y text-[0.95rem] transition-colors duration-150 bg-(--color-bg) focus:outline-none focus:border-(--color-primary)"
              ></textarea>
            </div>
          </div>
        {/if}
      </section>
    </div>

    <footer class="flex items-center justify-between px-6 py-4 border-t border-(--color-border-light) gap-4">
      {#if isEditing}
        <form
          method="POST"
          action="/calendar?/deleteEntry"
          use:enhance={({ cancel }) => {
            if (!confirmDelete()) {
              cancel();
              return;
            }
            saving = true;
            return ({ result }) => handleDeleteResult(result);
          }}
        >
          <input type="hidden" name="date" value={date} />
          <button type="submit" class="btn bg-(--color-danger-light) text-(--color-danger) hover:bg-(--color-danger) hover:text-white" disabled={saving}>
            Delete
          </button>
        </form>
      {/if}
      <div class="flex gap-2 ml-auto">
        <button type="button" class="btn btn-secondary" onclick={closeModal} disabled={saving}>
          Cancel
        </button>
        <form
          method="POST"
          action={isEditing ? '/calendar?/updateEntry' : '/calendar?/createEntry'}
          use:enhance={() => {
            saving = true;
            return ({ result }) => handleFormResult(result);
          }}
        >
          <input type="hidden" name="date" value={date} />
          <input type="hidden" name="data" value={JSON.stringify(getEntryData())} />
          <button type="submit" class="btn btn-primary" disabled={saving}>
            {saving ? 'Saving...' : (isEditing ? 'Update' : 'Save')}
          </button>
        </form>
      </div>
    </footer>
  </div>
</div>
