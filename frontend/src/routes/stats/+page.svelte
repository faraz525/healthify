<script lang="ts">
  import { goto } from '$app/navigation';
  import StatsCard from '$lib/components/StatsCard.svelte';

  let { data } = $props();

  function handlePeriodChange(e: Event) {
    const target = e.target as HTMLSelectElement;
    const newPeriod = target.value;
    goto(`/stats?days=${newPeriod}`);
  }

  // Safe accessors for stats
  const stats = $derived(data.stats ?? {
    totalEntries: 0,
    streakDays: 0,
    workoutDays: 0,
    workoutStreak: 0,
    avgStress: null,
    monthlyBreakdown: [],
    commonIssues: []
  });

  // Calculate max values for chart scaling
  const maxWorkouts = $derived(
    stats.monthlyBreakdown.length > 0
      ? Math.max(...stats.monthlyBreakdown.map(m => m.workoutCount), 1)
      : 1
  );

  const maxStress = 10; // Stress is always 1-10 scale
</script>

<div class="max-w-4xl mx-auto px-4 py-6 pb-24 sm:px-6 sm:py-8">
  <!-- Header -->
  <header class="mb-6 sm:mb-8">
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-2">
      <h1 class="text-3xl sm:text-4xl font-bold text-(--color-text) font-(family-name:--font-display)">Statistics</h1>
      <select
        class="w-full sm:w-auto px-4 py-2.5 bg-(--color-bg-card) border border-(--color-border) rounded-xl text-sm font-medium cursor-pointer focus:outline-none focus:border-(--color-primary)"
        value={data.period}
        onchange={handlePeriodChange}
      >
        <option value={7}>Last 7 days</option>
        <option value={30}>Last 30 days</option>
        <option value={90}>Last 90 days</option>
        <option value={365}>Last year</option>
      </select>
    </div>
    <p class="text-base sm:text-lg text-(--color-text-muted)">Your health insights at a glance</p>
  </header>

  <!-- Stats Grid -->
  <div class="grid grid-cols-2 gap-3 sm:gap-4 mb-6 sm:mb-8">
    <StatsCard
      label="Total Entries"
      value={stats.totalEntries}
      icon="calendar"
      color="primary"
    />
    <StatsCard
      label="Current Streak"
      value="{stats.streakDays} days"
      icon="fire"
      color="warning"
    />
    <StatsCard
      label="Workout Days"
      value={stats.workoutDays}
      icon="dumbbell"
      color="success"
    />
    <StatsCard
      label="Avg Stress"
      value={stats.avgStress ?? 'N/A'}
      icon="heart"
      color={stats.avgStress && stats.avgStress > 6 ? 'danger' : 'primary'}
    />
  </div>

  <!-- Workout Streak Highlight -->
  {#if stats.workoutStreak > 0}
    <div class="flex items-center gap-4 p-4 sm:p-5 mb-6 sm:mb-8 bg-gradient-to-r from-amber-400/15 to-orange-400/15 border border-amber-400/30 rounded-2xl">
      <div class="w-12 h-12 sm:w-14 sm:h-14 flex items-center justify-center rounded-xl bg-amber-500 text-white shrink-0">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
        </svg>
      </div>
      <div>
        <span class="block text-lg sm:text-xl font-bold text-(--color-text)">{stats.workoutStreak} day workout streak!</span>
        <span class="text-sm text-(--color-text-muted)">Keep up the great work!</span>
      </div>
    </div>
  {/if}

  <!-- Charts Section -->
  {#if stats.monthlyBreakdown.length > 0}
    <div class="space-y-4 sm:space-y-6 mb-6 sm:mb-8">
      <!-- Monthly Workouts Chart -->
      <div class="bg-(--color-bg-card) rounded-2xl border border-(--color-border-light) shadow-sm p-4 sm:p-6">
        <h2 class="text-lg sm:text-xl font-bold text-(--color-text) mb-4 sm:mb-6">Monthly Workouts</h2>
        <div class="flex items-end justify-around h-40 sm:h-48 gap-1 sm:gap-2">
          {#each stats.monthlyBreakdown as month}
            <div class="flex flex-col items-center flex-1 max-w-12 sm:max-w-16">
              <div class="w-full h-32 sm:h-40 flex items-end justify-center">
                <div
                  class="w-full rounded-t-lg bg-(--color-success) flex items-start justify-center pt-1 min-h-6 transition-all"
                  style="height: {Math.max((month.workoutCount / maxWorkouts) * 100, 15)}%"
                >
                  <span class="text-xs font-bold text-white">{month.workoutCount}</span>
                </div>
              </div>
              <span class="mt-2 text-xs text-(--color-text-muted) font-medium">{month.month}</span>
            </div>
          {/each}
        </div>
      </div>

      <!-- Monthly Stress Chart -->
      <div class="bg-(--color-bg-card) rounded-2xl border border-(--color-border-light) shadow-sm p-4 sm:p-6">
        <h2 class="text-lg sm:text-xl font-bold text-(--color-text) mb-4 sm:mb-6">Monthly Stress Levels</h2>
        <div class="flex items-end justify-around h-40 sm:h-48 gap-1 sm:gap-2">
          {#each stats.monthlyBreakdown as month}
            <div class="flex flex-col items-center flex-1 max-w-12 sm:max-w-16">
              <div class="w-full h-32 sm:h-40 flex items-end justify-center">
                {#if month.avgStress !== null}
                  <div
                    class="w-full rounded-t-lg flex items-start justify-center pt-1 min-h-6 transition-all {month.avgStress > 6 ? 'bg-(--color-danger)' : month.avgStress > 3 ? 'bg-(--color-warning)' : 'bg-(--color-success)'}"
                    style="height: {Math.max((month.avgStress / maxStress) * 100, 15)}%"
                  >
                    <span class="text-xs font-bold text-white">{month.avgStress}</span>
                  </div>
                {:else}
                  <div class="w-full rounded-t-lg bg-(--color-border) flex items-start justify-center pt-1 min-h-6">
                    <span class="text-xs font-medium text-(--color-text-muted)">-</span>
                  </div>
                {/if}
              </div>
              <span class="mt-2 text-xs text-(--color-text-muted) font-medium">{month.month}</span>
            </div>
          {/each}
        </div>
        <!-- Legend -->
        <div class="flex flex-wrap justify-center gap-3 sm:gap-6 mt-4 sm:mt-6 pt-4 border-t border-(--color-border-light)">
          <span class="flex items-center gap-1.5 text-xs text-(--color-text-muted)">
            <span class="w-3 h-3 rounded bg-(--color-success)"></span> Low (1-3)
          </span>
          <span class="flex items-center gap-1.5 text-xs text-(--color-text-muted)">
            <span class="w-3 h-3 rounded bg-(--color-warning)"></span> Medium (4-6)
          </span>
          <span class="flex items-center gap-1.5 text-xs text-(--color-text-muted)">
            <span class="w-3 h-3 rounded bg-(--color-danger)"></span> High (7-10)
          </span>
        </div>
      </div>
    </div>
  {/if}

  <!-- Common Issues -->
  {#if stats.commonIssues.length > 0}
    <div class="bg-(--color-bg-card) rounded-2xl border border-(--color-border-light) shadow-sm p-4 sm:p-6">
      <h2 class="text-lg sm:text-xl font-bold text-(--color-text) mb-4 sm:mb-6">Most Common Issues</h2>
      <div class="space-y-3">
        {#each stats.commonIssues as issue}
          <div class="flex items-center gap-3">
            <span class="text-sm font-medium text-(--color-text) w-24 sm:w-32 truncate shrink-0">{issue.displayName}</span>
            <div class="flex-1 h-2.5 bg-(--color-bg) rounded-full overflow-hidden">
              <div
                class="h-full bg-(--color-warning) rounded-full transition-all"
                style="width: {(issue.count / stats.commonIssues[0].count) * 100}%"
              ></div>
            </div>
            <span class="text-sm font-bold text-(--color-text-muted) w-8 text-right">{issue.count}</span>
          </div>
        {/each}
      </div>
    </div>
  {:else}
    <div class="bg-(--color-bg-card) rounded-2xl border border-(--color-border-light) shadow-sm p-8 sm:p-12 text-center">
      <div class="w-16 h-16 mx-auto mb-4 flex items-center justify-center text-(--color-success)">
        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
          <polyline points="22 4 12 14.01 9 11.01"></polyline>
        </svg>
      </div>
      <p class="text-(--color-text-muted)">No health issues logged in this period. Keep it up!</p>
    </div>
  {/if}
</div>

<!-- Styles handled by Tailwind CSS -->
