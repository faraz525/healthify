<script lang="ts">
  import { onMount } from 'svelte';
  import { api, type Stats } from '$lib/api';
  import StatsCard from '$lib/components/StatsCard.svelte';

  let stats = $state<Stats | null>(null);
  let period = $state(30);
  let loading = $state(true);

  async function loadStats() {
    loading = true;
    try {
      stats = await api.getStats(period);
    } catch (e) {
      console.error('Failed to load stats:', e);
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    loadStats();
  });

  function handlePeriodChange(e: Event) {
    const target = e.target as HTMLSelectElement;
    period = parseInt(target.value);
    loadStats();
  }
</script>

<div class="container">
  <div class="page-header">
    <div class="header-top">
      <h1>Statistics</h1>
      <select class="period-select" value={period} onchange={handlePeriodChange}>
        <option value={7}>Last 7 days</option>
        <option value={30}>Last 30 days</option>
        <option value={90}>Last 90 days</option>
        <option value={365}>Last year</option>
      </select>
    </div>
    <p class="subtitle">Your health insights at a glance</p>
  </div>

  {#if loading}
    <div class="loading">
      <div class="loading-spinner"></div>
      <p>Loading stats...</p>
    </div>
  {:else if stats}
    <div class="stats-grid">
      <StatsCard
        label="Total Entries"
        value={stats.total_entries}
        icon="📅"
        color="primary"
      />
      <StatsCard
        label="Current Streak"
        value="{stats.streak_days} days"
        icon="🔥"
        color="warning"
      />
      <StatsCard
        label="Workout Days"
        value={stats.workout_days}
        icon="💪"
        color="success"
      />
      <StatsCard
        label="Avg Stress Level"
        value={stats.avg_stress ?? 'N/A'}
        icon="😌"
        color={stats.avg_stress && stats.avg_stress > 6 ? 'danger' : 'primary'}
      />
    </div>

    {#if stats.common_issues.length > 0}
      <section class="issues-section card">
        <h2>Most Common Issues</h2>
        <div class="issues-list">
          {#each stats.common_issues as issue}
            <div class="issue-item">
              <span class="issue-name">{issue.type.replace(/_/g, ' ')}</span>
              <div class="issue-bar-container">
                <div
                  class="issue-bar"
                  style="width: {(issue.count / stats.common_issues[0].count) * 100}%"
                ></div>
              </div>
              <span class="issue-count">{issue.count}</span>
            </div>
          {/each}
        </div>
      </section>
    {:else}
      <section class="empty-section card">
        <p>No health issues logged in this period. Keep it up!</p>
      </section>
    {/if}
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
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: var(--space-lg);
    margin-bottom: var(--space-xl);
  }

  .issues-section {
    padding: var(--space-xl);
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
    text-transform: capitalize;
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
    padding: var(--space-xl);
    text-align: center;
    color: var(--color-text-muted);
  }

  .loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--space-md);
    padding: var(--space-2xl);
    color: var(--color-text-muted);
  }

  .loading-spinner {
    width: 40px;
    height: 40px;
    border: 3px solid var(--color-border);
    border-top-color: var(--color-primary);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  @media (max-width: 600px) {
    .header-top {
      flex-direction: column;
      align-items: flex-start;
      gap: var(--space-md);
    }

    .issue-item {
      grid-template-columns: 1fr 50px;
    }

    .issue-name {
      grid-column: 1 / -1;
    }
  }
</style>
