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

<div class="flex flex-col gap-4">
  <div class="flex flex-col gap-1">
    <input
      type="range"
      min="1"
      max="10"
      step="1"
      value={displayValue}
      oninput={handleInput}
      class="stress-range w-full h-3 rounded-full outline-none cursor-pointer max-sm:h-4 {value === null ? 'opacity-50' : ''}"
      style="--thumb-color: {getColor(displayValue)}"
      aria-label="Stress level from 1 to 10"
    />
    <div class="flex justify-between px-2 text-xs text-(--color-text-muted)">
      <span>1</span>
      <span>5</span>
      <span>10</span>
    </div>
  </div>

  <div class="flex items-center justify-center gap-2">
    {#if value !== null}
      <span class="font-(family-name:--font-display) text-2xl font-bold leading-none" style="color: {getColor(value)}">{value}</span>
    {/if}
    <span class="text-sm font-medium transition-colors duration-150" style="color: {value ? getColor(value) : 'var(--color-text-muted)'}">
      {getLabel(value)}
    </span>
  </div>
</div>

<style>
  .stress-range {
    -webkit-appearance: none;
    appearance: none;
    background: linear-gradient(
      to right,
      var(--color-success) 0%,
      var(--color-success) 22%,
      var(--color-warning) 33%,
      var(--color-warning) 55%,
      var(--color-danger) 66%,
      var(--color-danger) 100%
    );
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
    transition: transform 0.15s, box-shadow 0.15s;
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
    border-radius: 9999px;
    background: transparent;
  }

  /* Mobile optimizations */
  @media (max-width: 480px) {
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
