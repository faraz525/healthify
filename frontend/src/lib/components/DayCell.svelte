<script lang="ts">
  import type { DailyEntry } from '$lib/api';
  import { createEventDispatcher } from 'svelte';

  export let day: number;
  export let entry: DailyEntry | undefined = undefined;
  export let isToday = false;
  export let isFuture = false;

  const dispatch = createEventDispatcher();

  $: hasEntry = !!entry;
  $: hasWorkout = entry?.worked_out ?? false;
  $: hasIssues = (entry?.health_issues?.length ?? 0) > 0;
  $: stressLevel = entry?.stress_level ?? null;

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
  on:click={() => dispatch('click')}
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
      {#if hasWorkout}
        <div class="workout-indicator" title="Worked out">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20.57 14.86L22 13.43 20.57 12 17 15.57 8.43 7 12 3.43 10.57 2 9.14 3.43 7.71 2 5.57 4.14 4.14 2.71 2.71 4.14l1.43 1.43L2 7.71l1.43 1.43L2 10.57 3.43 12 7 8.43 15.57 17 12 20.57 13.43 22l1.43-1.43L16.29 22l2.14-2.14 1.43 1.43 1.43-1.43-1.43-1.43L22 16.29z"/>
          </svg>
        </div>
      {/if}
      {#if hasIssues}
        <div class="issue-indicator" title="{entry?.health_issues.length} health issue(s)">
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
    color: var(--color-success);
    display: flex;
    align-items: center;
  }

  .issue-indicator {
    color: var(--color-warning);
    display: flex;
    align-items: center;
  }
</style>
