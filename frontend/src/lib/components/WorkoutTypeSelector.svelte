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

<div class="workout-type-selector">
  {#if routineDays.length > 0}
    <div class="type-section">
      <span class="section-label">My Routines</span>
      <div class="type-grid routine-grid">
        {#each routineDays as day}
          <button
            class="type-btn routine"
            class:selected={isSelected(day.name)}
            onclick={() => selectType(day.name)}
            type="button"
          >
            <span class="type-label">{day.name}</span>
          </button>
        {/each}
      </div>
    </div>
  {/if}

  <div class="type-section">
    <span class="section-label">Cardio</span>
    <div class="type-grid">
      {#each cardioTypes as type}
        <button
          class="type-btn cardio"
          class:selected={isSelected(type.id)}
          onclick={() => selectType(type.id)}
          type="button"
        >
          <span class="type-emoji">{type.emoji}</span>
          <span class="type-label">{type.label}</span>
        </button>
      {/each}
    </div>
  </div>

  <div class="type-section">
    <span class="section-label">Flexibility & Recovery</span>
    <div class="type-grid">
      {#each [...flexibilityTypes, ...recoveryTypes] as type}
        <button
          class="type-btn flex"
          class:selected={isSelected(type.id)}
          onclick={() => selectType(type.id)}
          type="button"
        >
          <span class="type-emoji">{type.emoji}</span>
          <span class="type-label">{type.label}</span>
        </button>
      {/each}
    </div>
  </div>
</div>

<style>
  .workout-type-selector {
    display: flex;
    flex-direction: column;
    gap: var(--space-md);
  }

  .type-section {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
  }

  .section-label {
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--color-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .type-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
    gap: var(--space-sm);
  }

  .routine-grid {
    grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
  }

  .type-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--space-xs);
    padding: var(--space-sm);
    border-radius: var(--radius-md);
    background: var(--color-bg);
    border: 2px solid var(--color-border);
    transition: all var(--transition-fast);
    min-height: 50px;
  }

  .type-btn:hover {
    border-color: var(--color-primary);
    background: rgba(var(--color-primary-rgb), 0.05);
  }

  .type-btn.selected {
    border-color: var(--color-primary);
    background: rgba(var(--color-primary-rgb), 0.1);
  }

  .type-btn.routine {
    min-height: 44px;
  }

  .type-btn.routine:hover,
  .type-btn.routine.selected {
    border-color: var(--color-primary);
    background: rgba(var(--color-primary-rgb), 0.1);
  }

  .type-btn.cardio:hover,
  .type-btn.cardio.selected {
    border-color: var(--color-danger);
    background: rgba(212, 114, 106, 0.1);
  }

  .type-btn.flex:hover,
  .type-btn.flex.selected {
    border-color: var(--color-success);
    background: rgba(124, 174, 122, 0.1);
  }

  .type-emoji {
    font-size: 1.25rem;
  }

  .type-label {
    font-size: 0.75rem;
    font-weight: 500;
    color: var(--color-text-muted);
    text-align: center;
    line-height: 1.2;
  }

  .type-btn.selected .type-label {
    color: var(--color-text);
    font-weight: 600;
  }

  @media (max-width: 480px) {
    .type-grid {
      grid-template-columns: repeat(3, 1fr);
    }

    .routine-grid {
      grid-template-columns: repeat(2, 1fr);
    }

    .type-btn {
      min-height: 44px;
      padding: var(--space-xs);
    }

    .type-emoji {
      font-size: 1rem;
    }

    .type-label {
      font-size: 0.65rem;
    }
  }
</style>
