<script lang="ts">
  interface Props {
    value: number | null;
  }

  let { value = $bindable() }: Props = $props();

  const levels = Array.from({ length: 10 }, (_, i) => i + 1);

  function getColor(level: number): string {
    if (level <= 3) return 'var(--color-success)';
    if (level <= 6) return 'var(--color-warning)';
    return 'var(--color-danger)';
  }

  function getLabel(level: number | null): string {
    if (level === null) return 'Not set';
    if (level <= 2) return 'Very calm';
    if (level <= 4) return 'Relaxed';
    if (level <= 6) return 'Moderate';
    if (level <= 8) return 'Stressed';
    return 'Very stressed';
  }

  function handleClick(level: number) {
    value = value === level ? null : level;
  }
</script>

<div class="stress-slider">
  <div class="slider-track">
    {#each levels as level}
      <button
        class="level-btn"
        class:active={value === level}
        class:filled={value !== null && level <= value}
        style="--level-color: {getColor(level)}"
        onclick={() => handleClick(level)}
        aria-label="Stress level {level}"
      >
        {level}
      </button>
    {/each}
  </div>
  <div class="slider-labels">
    <span class="label-text" style="color: {value ? getColor(value) : 'var(--color-text-muted)'}">
      {getLabel(value)}
    </span>
  </div>
</div>

<style>
  .stress-slider {
    display: flex;
    flex-direction: column;
    gap: var(--space-md);
  }

  .slider-track {
    display: flex;
    gap: var(--space-xs);
  }

  .level-btn {
    flex: 1;
    aspect-ratio: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.875rem;
    font-weight: 600;
    border-radius: var(--radius-sm);
    background: var(--color-bg);
    color: var(--color-text-muted);
    border: 2px solid var(--color-border);
    transition: all var(--transition-fast);
  }

  .level-btn:hover {
    border-color: var(--level-color);
    color: var(--level-color);
  }

  .level-btn.filled {
    background: var(--level-color);
    border-color: var(--level-color);
    color: white;
    opacity: 0.3;
  }

  .level-btn.active {
    background: var(--level-color);
    border-color: var(--level-color);
    color: white;
    opacity: 1;
    transform: scale(1.1);
    box-shadow: 0 4px 12px color-mix(in srgb, var(--level-color) 40%, transparent);
  }

  .slider-labels {
    display: flex;
    justify-content: center;
  }

  .label-text {
    font-size: 0.875rem;
    font-weight: 500;
    transition: color var(--transition-fast);
  }
</style>
