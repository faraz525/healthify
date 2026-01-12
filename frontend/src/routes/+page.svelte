<script lang="ts">
  import Calendar from '$lib/components/Calendar.svelte';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  function getGreeting(): string {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  }
</script>

<div class="container">
  <div class="page-header">
    <h1>{getGreeting()}</h1>
    <p class="subtitle">
      {#if data.todayEntry}
        You've logged today's entry.
        {#if data.stats && data.stats.streakDays > 1}
          {data.stats.streakDays} day streak!
        {/if}
      {:else}
        Don't forget to log how you're feeling today.
      {/if}
    </p>
  </div>

  {#if data.stats}
    <div class="quick-stats">
      <div class="stat-item">
        <span class="stat-value">{data.stats.streakDays}</span>
        <span class="stat-label">Day Streak</span>
      </div>
      <div class="stat-divider"></div>
      <div class="stat-item">
        <span class="stat-value">{data.stats.workoutDays}</span>
        <span class="stat-label">Workouts (7d)</span>
      </div>
      <div class="stat-divider"></div>
      <div class="stat-item">
        <span class="stat-value">{data.stats.avgStress ?? '—'}</span>
        <span class="stat-label">Avg Stress</span>
      </div>
    </div>
  {/if}

  <Calendar />
</div>

<style>
  .page-header {
    margin-bottom: var(--space-xl);
  }

  .page-header h1 {
    font-size: 2.5rem;
    margin-bottom: var(--space-sm);
  }

  .subtitle {
    font-size: 1.125rem;
    color: var(--color-text-muted);
  }

  .quick-stats {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-xl);
    padding: var(--space-lg) var(--space-xl);
    background: var(--color-bg-card);
    border-radius: var(--radius-lg);
    margin-bottom: var(--space-xl);
    box-shadow: var(--shadow-sm);
    border: 1px solid var(--color-border-light);
  }

  .stat-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-xs);
  }

  .stat-value {
    font-family: var(--font-display);
    font-size: 2rem;
    font-weight: 600;
    color: var(--color-primary);
  }

  .stat-label {
    font-size: 0.875rem;
    color: var(--color-text-muted);
  }

  .stat-divider {
    width: 1px;
    height: 40px;
    background: var(--color-border);
  }

  @media (max-width: 600px) {
    .page-header h1 {
      font-size: 2rem;
    }

    .quick-stats {
      flex-direction: column;
      gap: var(--space-md);
    }

    .stat-divider {
      width: 60px;
      height: 1px;
    }
  }
</style>
