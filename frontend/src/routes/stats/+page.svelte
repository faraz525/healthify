<script lang="ts">
  import { goto } from '$app/navigation';
  import StatsCard from '$lib/components/StatsCard.svelte';

  let { data } = $props();

  function handlePeriodChange(e: Event) {
    const target = e.target as HTMLSelectElement;
    const newPeriod = target.value;
    goto(`/stats?days=${newPeriod}`);
  }

  // Calculate max values for chart scaling
  const maxWorkouts = $derived(
    data.stats.monthlyBreakdown.length > 0
      ? Math.max(...data.stats.monthlyBreakdown.map(m => m.workoutCount), 1)
      : 1
  );

  const maxStress = 10; // Stress is always 1-10 scale
</script>

<div class="container">
  <div class="page-header">
    <div class="header-top">
      <h1>Statistics</h1>
      <select class="period-select" value={data.period} onchange={handlePeriodChange}>
        <option value={7}>Last 7 days</option>
        <option value={30}>Last 30 days</option>
        <option value={90}>Last 90 days</option>
        <option value={365}>Last year</option>
      </select>
    </div>
    <p class="subtitle">Your health insights at a glance</p>
  </div>

  <div class="stats-grid">
    <StatsCard
      label="Total Entries"
      value={data.stats.totalEntries}
      icon="calendar"
      color="primary"
    />
    <StatsCard
      label="Current Streak"
      value="{data.stats.streakDays} days"
      icon="fire"
      color="warning"
    />
    <StatsCard
      label="Workout Days"
      value={data.stats.workoutDays}
      icon="dumbbell"
      color="success"
    />
    <StatsCard
      label="Avg Stress Level"
      value={data.stats.avgStress ?? 'N/A'}
      icon="heart"
      color={data.stats.avgStress && data.stats.avgStress > 6 ? 'danger' : 'primary'}
    />
  </div>

  {#if data.stats.workoutStreak > 0}
    <div class="streak-highlight card">
      <div class="streak-icon">
        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
        </svg>
      </div>
      <div class="streak-content">
        <span class="streak-value">{data.stats.workoutStreak} day workout streak!</span>
        <span class="streak-label">Keep up the great work!</span>
      </div>
    </div>
  {/if}

  {#if data.stats.monthlyBreakdown.length > 0}
    <section class="charts-section">
      <div class="chart-card card">
        <h2>Monthly Workouts</h2>
        <div class="bar-chart">
          {#each data.stats.monthlyBreakdown as month}
            <div class="bar-group">
              <div class="bar-container">
                <div
                  class="bar bar-workout"
                  style="height: {(month.workoutCount / maxWorkouts) * 100}%"
                  title="{month.workoutCount} workouts"
                >
                  <span class="bar-value">{month.workoutCount}</span>
                </div>
              </div>
              <span class="bar-label">{month.month}</span>
            </div>
          {/each}
        </div>
      </div>

      <div class="chart-card card">
        <h2>Monthly Stress Levels</h2>
        <div class="bar-chart">
          {#each data.stats.monthlyBreakdown as month}
            <div class="bar-group">
              <div class="bar-container">
                {#if month.avgStress !== null}
                  <div
                    class="bar bar-stress"
                    class:high-stress={month.avgStress > 6}
                    class:medium-stress={month.avgStress > 3 && month.avgStress <= 6}
                    class:low-stress={month.avgStress <= 3}
                    style="height: {(month.avgStress / maxStress) * 100}%"
                    title="Avg stress: {month.avgStress}"
                  >
                    <span class="bar-value">{month.avgStress}</span>
                  </div>
                {:else}
                  <div class="bar bar-empty" title="No data">
                    <span class="bar-value">-</span>
                  </div>
                {/if}
              </div>
              <span class="bar-label">{month.month}</span>
            </div>
          {/each}
        </div>
        <div class="stress-legend">
          <span class="legend-item"><span class="legend-color low"></span> Low (1-3)</span>
          <span class="legend-item"><span class="legend-color medium"></span> Medium (4-6)</span>
          <span class="legend-item"><span class="legend-color high"></span> High (7-10)</span>
        </div>
      </div>
    </section>
  {/if}

  {#if data.stats.commonIssues.length > 0}
    <section class="issues-section card">
      <h2>Most Common Issues</h2>
      <div class="issues-list">
        {#each data.stats.commonIssues as issue}
          <div class="issue-item">
            <span class="issue-name">{issue.displayName}</span>
            <div class="issue-bar-container">
              <div
                class="issue-bar"
                style="width: {(issue.count / data.stats.commonIssues[0].count) * 100}%"
              ></div>
            </div>
            <span class="issue-count">{issue.count}</span>
          </div>
        {/each}
      </div>
    </section>
  {:else}
    <section class="empty-section card">
      <div class="empty-icon">
        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
          <polyline points="22 4 12 14.01 9 11.01"></polyline>
        </svg>
      </div>
      <p>No health issues logged in this period. Keep it up!</p>
    </section>
  {/if}
</div>

<style>
  .page-header {
    margin-bottom: var(--space-xl);
  }

  .header-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: var(--space-sm);
  }

  .page-header h1 {
    font-size: 2.5rem;
  }

  .subtitle {
    font-size: 1.125rem;
    color: var(--color-text-muted);
  }

  .period-select {
    padding: var(--space-sm) var(--space-md);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    background: var(--color-bg-card);
    color: var(--color-text);
    font-size: 0.95rem;
    cursor: pointer;
  }

  .period-select:focus {
    outline: none;
    border-color: var(--color-primary);
  }

  .stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: var(--space-lg);
    margin-bottom: var(--space-xl);
  }

  .streak-highlight {
    display: flex;
    align-items: center;
    gap: var(--space-lg);
    padding: var(--space-lg);
    margin-bottom: var(--space-xl);
    background: linear-gradient(135deg, var(--color-warning-light), rgba(var(--color-warning-rgb, 255, 193, 7), 0.05));
    border: 1px solid var(--color-warning);
  }

  .streak-icon {
    width: 56px;
    height: 56px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--radius-md);
    background: var(--color-warning);
    color: white;
  }

  .streak-content {
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
  }

  .streak-value {
    font-family: var(--font-display);
    font-size: 1.5rem;
    font-weight: 600;
    color: var(--color-text);
  }

  .streak-label {
    font-size: 0.875rem;
    color: var(--color-text-muted);
  }

  .charts-section {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: var(--space-lg);
    margin-bottom: var(--space-xl);
  }

  .chart-card {
    padding: var(--space-xl);
  }

  .chart-card h2 {
    font-size: 1.25rem;
    margin-bottom: var(--space-lg);
  }

  .bar-chart {
    display: flex;
    align-items: flex-end;
    justify-content: space-around;
    height: 200px;
    gap: var(--space-sm);
  }

  .bar-group {
    display: flex;
    flex-direction: column;
    align-items: center;
    flex: 1;
    max-width: 60px;
  }

  .bar-container {
    width: 100%;
    height: 160px;
    display: flex;
    align-items: flex-end;
    justify-content: center;
  }

  .bar {
    width: 80%;
    min-height: 24px;
    border-radius: var(--radius-sm) var(--radius-sm) 0 0;
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding-top: var(--space-xs);
    transition: height var(--transition-base);
  }

  .bar-workout {
    background: var(--color-success);
  }

  .bar-stress.low-stress {
    background: var(--color-success);
  }

  .bar-stress.medium-stress {
    background: var(--color-warning);
  }

  .bar-stress.high-stress {
    background: var(--color-danger);
  }

  .bar-empty {
    background: var(--color-border);
    height: 24px;
  }

  .bar-value {
    font-size: 0.75rem;
    font-weight: 600;
    color: white;
  }

  .bar-empty .bar-value {
    color: var(--color-text-muted);
  }

  .bar-label {
    margin-top: var(--space-sm);
    font-size: 0.75rem;
    color: var(--color-text-muted);
  }

  .stress-legend {
    display: flex;
    justify-content: center;
    gap: var(--space-lg);
    margin-top: var(--space-lg);
    padding-top: var(--space-md);
    border-top: 1px solid var(--color-border-light);
  }

  .legend-item {
    display: flex;
    align-items: center;
    gap: var(--space-xs);
    font-size: 0.75rem;
    color: var(--color-text-muted);
  }

  .legend-color {
    width: 12px;
    height: 12px;
    border-radius: 2px;
  }

  .legend-color.low {
    background: var(--color-success);
  }

  .legend-color.medium {
    background: var(--color-warning);
  }

  .legend-color.high {
    background: var(--color-danger);
  }

  .issues-section {
    padding: var(--space-xl);
    margin-bottom: var(--space-xl);
  }

  .issues-section h2 {
    font-size: 1.25rem;
    margin-bottom: var(--space-lg);
  }

  .issues-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-md);
  }

  .issue-item {
    display: grid;
    grid-template-columns: 150px 1fr 50px;
    align-items: center;
    gap: var(--space-md);
  }

  .issue-name {
    font-weight: 500;
    color: var(--color-text);
  }

  .issue-bar-container {
    height: 8px;
    background: var(--color-bg);
    border-radius: var(--radius-full);
    overflow: hidden;
  }

  .issue-bar {
    height: 100%;
    background: var(--color-warning);
    border-radius: var(--radius-full);
    transition: width var(--transition-base);
  }

  .issue-count {
    font-weight: 600;
    color: var(--color-text-muted);
    text-align: right;
  }

  .empty-section {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-md);
    padding: var(--space-2xl);
    text-align: center;
    color: var(--color-text-muted);
  }

  .empty-icon {
    color: var(--color-success);
  }

  @media (max-width: 768px) {
    .charts-section {
      grid-template-columns: 1fr;
    }

    .bar-chart {
      height: 180px;
    }

    .bar-container {
      height: 140px;
    }
  }

  @media (max-width: 600px) {
    .header-top {
      flex-direction: column;
      align-items: flex-start;
      gap: var(--space-md);
    }

    .page-header h1 {
      font-size: 2rem;
    }

    .stats-grid {
      grid-template-columns: 1fr;
    }

    .issue-item {
      grid-template-columns: 1fr 50px;
    }

    .issue-name {
      grid-column: 1 / -1;
    }

    .streak-highlight {
      flex-direction: column;
      text-align: center;
    }

    .streak-content {
      align-items: center;
    }

    .stress-legend {
      flex-direction: column;
      align-items: center;
      gap: var(--space-sm);
    }
  }
</style>
