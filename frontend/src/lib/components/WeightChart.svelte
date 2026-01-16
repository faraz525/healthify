<script lang="ts">
  interface HistoryLog {
    weight: string | null;
    reps: number | null;
    sessionDate: string | null;
  }

  interface Props {
    data: HistoryLog[];
  }

  let { data }: Props = $props();

  // Process data: get max weight per date, sorted chronologically
  let chartData = $derived.by(() => {
    if (!data || data.length === 0) return [];

    // Group by date and get max weight
    const byDate: Record<string, number> = {};
    for (const log of data) {
      if (!log.sessionDate || !log.weight) continue;
      const weight = parseFloat(log.weight) || 0;
      if (!byDate[log.sessionDate] || weight > byDate[log.sessionDate]) {
        byDate[log.sessionDate] = weight;
      }
    }

    // Convert to array and sort by date (oldest first)
    return Object.entries(byDate)
      .map(([date, weight]) => ({ date, weight }))
      .sort((a, b) => a.date.localeCompare(b.date));
  });

  // Chart dimensions
  const width = 320;
  const height = 140;
  const padding = { top: 20, right: 15, bottom: 30, left: 45 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  // Calculate scales
  let yMin = $derived(chartData.length > 0 ? Math.min(...chartData.map(d => d.weight)) * 0.9 : 0);
  let yMax = $derived(chartData.length > 0 ? Math.max(...chartData.map(d => d.weight)) * 1.05 : 100);

  function getX(index: number): number {
    if (chartData.length <= 1) return padding.left + chartWidth / 2;
    return padding.left + (index / (chartData.length - 1)) * chartWidth;
  }

  function getY(weight: number): number {
    if (yMax === yMin) return padding.top + chartHeight / 2;
    return padding.top + chartHeight - ((weight - yMin) / (yMax - yMin)) * chartHeight;
  }

  // Generate path for the line
  let linePath = $derived.by(() => {
    if (chartData.length === 0) return '';
    return chartData.map((d, i) => {
      const x = getX(i);
      const y = getY(d.weight);
      return i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`;
    }).join(' ');
  });

  // Generate area fill path
  let areaPath = $derived.by(() => {
    if (chartData.length === 0) return '';
    const line = chartData.map((d, i) => {
      const x = getX(i);
      const y = getY(d.weight);
      return i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`;
    }).join(' ');
    const lastX = getX(chartData.length - 1);
    const firstX = getX(0);
    const bottomY = padding.top + chartHeight;
    return `${line} L ${lastX} ${bottomY} L ${firstX} ${bottomY} Z`;
  });

  // Y-axis ticks
  let yTicks = $derived.by(() => {
    const range = yMax - yMin;
    const step = range / 3;
    return [yMin, yMin + step, yMin + step * 2, yMax].map(v => Math.round(v));
  });

  // Format date for display
  function formatDate(dateStr: string): string {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
</script>

{#if chartData.length >= 2}
  <div class="w-full overflow-x-auto">
    <svg viewBox="0 0 {width} {height}" class="w-full max-w-sm mx-auto" style="min-width: 280px;">
      <!-- Grid lines -->
      {#each yTicks as tick}
        <line
          x1={padding.left}
          y1={getY(tick)}
          x2={width - padding.right}
          y2={getY(tick)}
          stroke="var(--color-border-light)"
          stroke-dasharray="3,3"
        />
        <text
          x={padding.left - 8}
          y={getY(tick)}
          text-anchor="end"
          dominant-baseline="middle"
          class="text-[10px] fill-(--color-text-muted)"
        >
          {tick}
        </text>
      {/each}

      <!-- Area fill -->
      <path d={areaPath} fill="var(--color-primary)" fill-opacity="0.1" />

      <!-- Line -->
      <path d={linePath} fill="none" stroke="var(--color-primary)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />

      <!-- Data points -->
      {#each chartData as point, i}
        <circle
          cx={getX(i)}
          cy={getY(point.weight)}
          r="4"
          fill="var(--color-bg-card)"
          stroke="var(--color-primary)"
          stroke-width="2"
        />
      {/each}

      <!-- X-axis labels (first and last) -->
      {#if chartData.length > 0}
        <text
          x={getX(0)}
          y={height - 8}
          text-anchor="start"
          class="text-[10px] fill-(--color-text-muted)"
        >
          {formatDate(chartData[0].date)}
        </text>
        {#if chartData.length > 1}
          <text
            x={getX(chartData.length - 1)}
            y={height - 8}
            text-anchor="end"
            class="text-[10px] fill-(--color-text-muted)"
          >
            {formatDate(chartData[chartData.length - 1].date)}
          </text>
        {/if}
      {/if}

      <!-- Y-axis label -->
      <text
        x={12}
        y={padding.top + chartHeight / 2}
        text-anchor="middle"
        transform="rotate(-90, 12, {padding.top + chartHeight / 2})"
        class="text-[10px] fill-(--color-text-muted) font-medium"
      >
        Weight
      </text>
    </svg>
  </div>
{:else if chartData.length === 1}
  <div class="text-center py-4 text-sm text-(--color-text-muted)">
    <p>One session recorded at <span class="font-semibold">{chartData[0].weight}</span></p>
    <p class="text-xs mt-1">Log more sessions to see your progress chart</p>
  </div>
{/if}
