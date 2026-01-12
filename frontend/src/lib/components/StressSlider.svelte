<script lang="ts">
  interface Props {
    value: number | null;
  }

  let { value = $bindable() }: Props = $props();

  // Default to 5 for display purposes, but track if user has set it
  let displayValue = $derived(value ?? 5);

  function getColor(level: number): string {
    if (level <= 3) return 'var(--color-success)';
    if (level <= 6) return 'var(--color-warning)';
    return 'var(--color-danger)';
  }

  function getLabel(level: number | null): string {
    if (level === null) return 'Drag to set stress level';
    if (level <= 2) return 'Very calm';
    if (level <= 4) return 'Relaxed';
    if (level <= 6) return 'Moderate';
    if (level <= 8) return 'Stressed';
    return 'Very stressed';
  }

  function handleInput(e: Event) {
    const target = e.target as HTMLInputElement;
    value = parseInt(target.value);
  }

  // Calculate gradient stop position based on value
  let gradientPercent = $derived(((displayValue - 1) / 9) * 100);
</script>

<div class="stress-slider">
  <div class="slider-container">
    <input
      type="range"
      min="1"
      max="10"
      step="1"
      value={displayValue}
      oninput={handleInput}
      class="stress-range"
      class:unset={value === null}
      style="--progress: {gradientPercent}%; --thumb-color: {getColor(displayValue)}"
      aria-label="Stress level from 1 to 10"
    />
    <div class="range-labels">
      <span>1</span>
      <span>5</span>
      <span>10</span>
    </div>
  </div>

  <div class="value-display">
    {#if value !== null}
      <span class="value-number" style="color: {getColor(value)}">{value}</span>
    {/if}
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

  .slider-container {
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
  }

  .stress-range {
    -webkit-appearance: none;
    appearance: none;
    width: 100%;
    height: 12px;
    border-radius: var(--radius-full);
    background: linear-gradient(
      to right,
      var(--color-success) 0%,
      var(--color-success) 22%,
      var(--color-warning) 33%,
      var(--color-warning) 55%,
      var(--color-danger) 66%,
      var(--color-danger) 100%
    );
    outline: none;
    cursor: pointer;
  }

  .stress-range.unset {
    opacity: 0.5;
  }

  /* Webkit (Chrome, Safari, Edge) */
  .stress-range::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 44px;
    height: 44px;
    border-radius: 50%;
    background: white;
    border: 4px solid var(--thumb-color, var(--color-primary));
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
    cursor: grab;
    transition: transform var(--transition-fast), box-shadow var(--transition-fast);
  }

  .stress-range::-webkit-slider-thumb:hover {
    transform: scale(1.1);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
  }

  .stress-range::-webkit-slider-thumb:active {
    cursor: grabbing;
    transform: scale(1.05);
  }

  /* Firefox */
  .stress-range::-moz-range-thumb {
    width: 44px;
    height: 44px;
    border-radius: 50%;
    background: white;
    border: 4px solid var(--thumb-color, var(--color-primary));
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
    cursor: grab;
  }

  .stress-range::-moz-range-thumb:hover {
    transform: scale(1.1);
  }

  .stress-range::-moz-range-track {
    height: 12px;
    border-radius: var(--radius-full);
    background: transparent;
  }

  .range-labels {
    display: flex;
    justify-content: space-between;
    padding: 0 var(--space-sm);
    font-size: 0.75rem;
    color: var(--color-text-muted);
  }

  .value-display {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-sm);
  }

  .value-number {
    font-family: var(--font-display);
    font-size: 1.5rem;
    font-weight: 700;
    line-height: 1;
  }

  .label-text {
    font-size: 0.875rem;
    font-weight: 500;
    transition: color var(--transition-fast);
  }

  /* Mobile optimizations */
  @media (max-width: 480px) {
    .stress-range {
      height: 16px;
    }

    .stress-range::-webkit-slider-thumb {
      width: 48px;
      height: 48px;
    }

    .stress-range::-moz-range-thumb {
      width: 48px;
      height: 48px;
    }
  }
</style>
