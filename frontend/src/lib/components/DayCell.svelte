<script lang="ts">
  import type { DailyEntry } from '$lib/stores/entries';
  import { getWorkoutDisplay } from '$lib/config/workoutTypes';

  interface Props {
    day: number;
    entry?: DailyEntry;
    isToday?: boolean;
    isFuture?: boolean;
    onclick?: () => void;
  }

  let { day, entry, isToday = false, isFuture = false, onclick }: Props = $props();

  let hasEntry = $derived(!!entry);
  let hasWorkout = $derived(entry?.workedOut ?? false);
  let workoutType = $derived(entry?.workoutType ?? null);
  let workoutNotes = $derived(entry?.workoutNotes ?? null);
  let workoutDisplay = $derived(hasWorkout ? getWorkoutDisplay(workoutType) : null);
  let hasIssues = $derived((entry?.healthIssues?.length ?? 0) > 0);
  let stressLevel = $derived(entry?.stressLevel ?? null);
  // Check if workout notes contain PR (from auto-synced sessions)
  let hasPR = $derived(workoutNotes?.includes('PR') ?? false);

  function getStressColor(level: number | null): string {
    if (level === null) return 'transparent';
    if (level <= 3) return 'var(--color-success)';
    if (level <= 6) return 'var(--color-warning)';
    return 'var(--color-danger)';
  }
</script>

<button
  class="day-cell"
  class:today={isToday}
  class:future={isFuture}
  class:has-entry={hasEntry}
  disabled={isFuture}
  {onclick}
>
  <span class="day-number">{day}</span>

  {#if hasEntry}
    <div class="indicators">
      {#if stressLevel !== null}
        <div
          class="stress-dot"
          style="background-color: {getStressColor(stressLevel)}"
          title="Stress: {stressLevel}/10"
        ></div>
      {/if}
      {#if hasWorkout && workoutDisplay}
        <div class="workout-indicator" class:has-emoji={workoutDisplay.emoji} title={workoutNotes || workoutType || 'Worked out'}>
          <span class="workout-text">{workoutDisplay.text}</span>
          {#if hasPR}
            <span class="pr-badge" title="Personal Record!">!</span>
          {/if}
        </div>
      {/if}
      {#if hasIssues}
        <div class="issue-indicator" title="{entry?.healthIssues.length} health issue(s)">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
          </svg>
        </div>
      {/if}
    </div>
  {/if}
</button>

<style>
  .day-cell {
    aspect-ratio: 1;
    min-height: 44px;
    min-width: 44px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    padding: var(--space-xs);
    border-radius: var(--radius-md);
    background: transparent;
    border: 2px solid transparent;
    transition: all var(--transition-fast);
    position: relative;
  }

  .day-cell:not(.future):hover {
    background: var(--color-bg-hover);
    border-color: var(--color-border);
    transform: scale(1.02);
  }

  .day-cell.today {
    background: rgba(var(--color-primary-rgb), 0.1);
    border-color: var(--color-primary);
  }

  .day-cell.today .day-number {
    color: var(--color-primary);
    font-weight: 700;
  }

  .day-cell.future {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .day-cell.has-entry {
    background: var(--color-bg-hover);
  }

  .day-number {
    font-size: 1rem;
    font-weight: 500;
    color: var(--color-text);
  }

  .indicators {
    display: flex;
    gap: 3px;
    align-items: center;
    justify-content: center;
    flex-wrap: wrap;
  }

  .stress-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
  }

  .workout-indicator {
    display: flex;
    align-items: center;
  }

  .workout-text {
    font-size: 0.6rem;
    font-weight: 700;
    line-height: 1;
    color: var(--color-success);
    letter-spacing: -0.02em;
  }

  .workout-indicator.has-emoji .workout-text {
    font-size: 0.75rem;
    font-weight: normal;
  }

  .pr-badge {
    font-size: 0.55rem;
    font-weight: 800;
    color: white;
    background: var(--color-warning);
    border-radius: 50%;
    width: 12px;
    height: 12px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    margin-left: 1px;
  }

  .issue-indicator {
    color: var(--color-warning);
    display: flex;
    align-items: center;
  }

  /* Mobile responsiveness */
  @media (max-width: 480px) {
    .day-cell {
      min-height: 48px;
      min-width: 48px;
      gap: 2px;
      padding: 4px;
      border-radius: var(--radius-sm);
    }

    .day-number {
      font-size: 0.85rem;
    }

    .indicators {
      gap: 2px;
    }

    .stress-dot {
      width: 8px;
      height: 8px;
    }

    .workout-text {
      font-size: 0.55rem;
    }

    .workout-indicator.has-emoji .workout-text {
      font-size: 0.65rem;
    }

    .pr-badge {
      width: 10px;
      height: 10px;
      font-size: 0.5rem;
    }

    .issue-indicator svg {
      width: 12px;
      height: 12px;
    }
  }
</style>
