<script lang="ts">
  import { workoutTypes, type WorkoutType } from '$lib/config/workoutTypes';

  // Local type definition instead of importing from API
  interface WorkoutDay {
    id: number;
    name: string;
    dayOfWeek: number | null;
    sortOrder: number;
  }

  interface Props {
    value: string | null;
    routineDays?: WorkoutDay[];
    onchange?: (value: string | null) => void;
  }

  let { value = $bindable(), routineDays = [], onchange }: Props = $props();

  function selectType(id: string) {
    if (value === id) {
      value = null;
    } else {
      value = id;
    }
    onchange?.(value);
  }

  function isSelected(id: string): boolean {
    return value === id;
  }

  // Group predefined types by category
  const cardioTypes = workoutTypes.filter(t => t.category === 'cardio');
  const flexibilityTypes = workoutTypes.filter(t => t.category === 'flexibility');
  const recoveryTypes = workoutTypes.filter(t => t.category === 'recovery');
</script>

<div class="flex flex-col gap-4">
  {#if routineDays.length > 0}
    <div class="flex flex-col gap-2">
      <span class="text-xs font-semibold text-(--color-text-muted) uppercase tracking-wider">My Routines</span>
      <div class="grid grid-cols-[repeat(auto-fill,minmax(100px,1fr))] gap-2 max-sm:grid-cols-2">
        {#each routineDays as day}
          <button
            class="flex flex-col items-center justify-center gap-1 p-2 rounded-xl bg-(--color-bg) border-2 border-(--color-border) transition-all duration-150 min-h-11 hover:border-(--color-primary) hover:bg-(--color-primary)/5 max-sm:min-h-11 max-sm:p-1
              {isSelected(day.name) ? 'border-(--color-primary) bg-(--color-primary)/10' : ''}"
            onclick={() => selectType(day.name)}
            type="button"
          >
            <span class="text-xs font-medium text-(--color-text-muted) text-center leading-tight {isSelected(day.name) ? 'text-(--color-text) font-semibold' : ''} max-sm:text-[0.65rem]">{day.name}</span>
          </button>
        {/each}
      </div>
    </div>
  {/if}

  <div class="flex flex-col gap-2">
    <span class="text-xs font-semibold text-(--color-text-muted) uppercase tracking-wider">Cardio</span>
    <div class="grid grid-cols-[repeat(auto-fill,minmax(80px,1fr))] gap-2 max-sm:grid-cols-3">
      {#each cardioTypes as type}
        <button
          class="flex flex-col items-center justify-center gap-1 p-2 rounded-xl bg-(--color-bg) border-2 border-(--color-border) transition-all duration-150 min-h-[50px] hover:border-(--color-danger) hover:bg-[rgba(212,114,106,0.1)] max-sm:min-h-11 max-sm:p-1
            {isSelected(type.id) ? 'border-(--color-danger) bg-[rgba(212,114,106,0.1)]' : ''}"
          onclick={() => selectType(type.id)}
          type="button"
        >
          <span class="text-xl max-sm:text-base">{type.emoji}</span>
          <span class="text-xs font-medium text-(--color-text-muted) text-center leading-tight {isSelected(type.id) ? 'text-(--color-text) font-semibold' : ''} max-sm:text-[0.65rem]">{type.label}</span>
        </button>
      {/each}
    </div>
  </div>

  <div class="flex flex-col gap-2">
    <span class="text-xs font-semibold text-(--color-text-muted) uppercase tracking-wider">Flexibility & Recovery</span>
    <div class="grid grid-cols-[repeat(auto-fill,minmax(80px,1fr))] gap-2 max-sm:grid-cols-3">
      {#each [...flexibilityTypes, ...recoveryTypes] as type}
        <button
          class="flex flex-col items-center justify-center gap-1 p-2 rounded-xl bg-(--color-bg) border-2 border-(--color-border) transition-all duration-150 min-h-[50px] hover:border-(--color-success) hover:bg-[rgba(124,174,122,0.1)] max-sm:min-h-11 max-sm:p-1
            {isSelected(type.id) ? 'border-(--color-success) bg-[rgba(124,174,122,0.1)]' : ''}"
          onclick={() => selectType(type.id)}
          type="button"
        >
          <span class="text-xl max-sm:text-base">{type.emoji}</span>
          <span class="text-xs font-medium text-(--color-text-muted) text-center leading-tight {isSelected(type.id) ? 'text-(--color-text) font-semibold' : ''} max-sm:text-[0.65rem]">{type.label}</span>
        </button>
      {/each}
    </div>
  </div>
</div>
