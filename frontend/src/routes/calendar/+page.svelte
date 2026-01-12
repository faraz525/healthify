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
  <div class="mb-8">
    <h1 class="text-4xl max-sm:text-3xl mb-2">{getGreeting()}</h1>
    <p class="text-lg text-(--color-text-muted)">
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
    <div class="card flex items-center justify-center gap-8 px-8 py-6 mb-8 max-sm:flex-col max-sm:gap-4">
      <div class="flex flex-col items-center gap-1">
        <span class="font-(family-name:--font-display) text-3xl font-semibold text-(--color-primary)">{data.stats.streakDays}</span>
        <span class="text-sm text-(--color-text-muted)">Day Streak</span>
      </div>
      <div class="w-px h-10 bg-(--color-border) max-sm:w-15 max-sm:h-px"></div>
      <div class="flex flex-col items-center gap-1">
        <span class="font-(family-name:--font-display) text-3xl font-semibold text-(--color-primary)">{data.stats.workoutDays}</span>
        <span class="text-sm text-(--color-text-muted)">Workouts (7d)</span>
      </div>
      <div class="w-px h-10 bg-(--color-border) max-sm:w-15 max-sm:h-px"></div>
      <div class="flex flex-col items-center gap-1">
        <span class="font-(family-name:--font-display) text-3xl font-semibold text-(--color-primary)">{data.stats.avgStress ?? '—'}</span>
        <span class="text-sm text-(--color-text-muted)">Avg Stress</span>
      </div>
    </div>
  {/if}

  <Calendar />
</div>
