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
  class="aspect-square min-h-11 min-w-11 flex flex-col items-center justify-center gap-1 p-1 rounded-xl bg-transparent border-2 border-transparent transition-all duration-150 relative
    {!isFuture ? 'hover:bg-(--color-bg-hover) hover:border-(--color-border) hover:scale-[1.02]' : 'opacity-40 cursor-not-allowed'}
    {isToday ? 'bg-(--color-primary)/10 border-(--color-primary)' : ''}
    {hasEntry && !isToday ? 'bg-(--color-bg-hover)' : ''}
    max-sm:min-h-12 max-sm:min-w-12 max-sm:gap-0.5 max-sm:p-1 max-sm:rounded-lg"
  disabled={isFuture}
  {onclick}
>
  <span class="text-base font-medium text-(--color-text) {isToday ? 'text-(--color-primary) font-bold' : ''} max-sm:text-sm">{day}</span>

  {#if hasEntry}
    <div class="flex gap-0.5 items-center justify-center flex-wrap max-sm:gap-0.5">
      {#if stressLevel !== null}
        <div
          class="w-2 h-2 rounded-full"
          style="background-color: {getStressColor(stressLevel)}"
          title="Stress: {stressLevel}/10"
        ></div>
      {/if}
      {#if hasWorkout && workoutDisplay}
        <div class="flex items-center" title={workoutNotes || workoutType || 'Worked out'}>
          <span class="text-[0.6rem] font-bold leading-none text-(--color-success) tracking-tight {workoutDisplay.emoji ? 'text-xs font-normal' : ''} max-sm:text-[0.55rem] max-sm:{workoutDisplay.emoji ? 'text-[0.65rem]' : ''}">{workoutDisplay.text}</span>
          {#if hasPR}
            <span class="text-[0.55rem] font-extrabold text-white bg-(--color-warning) rounded-full w-3 h-3 inline-flex items-center justify-center ml-px max-sm:w-2.5 max-sm:h-2.5 max-sm:text-[0.5rem]" title="Personal Record!">!</span>
          {/if}
        </div>
      {/if}
      {#if hasIssues}
        <div class="text-(--color-warning) flex items-center" title="{entry?.healthIssues.length} health issue(s)">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" class="max-sm:w-3 max-sm:h-3">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
          </svg>
        </div>
      {/if}
    </div>
  {/if}
</button>
