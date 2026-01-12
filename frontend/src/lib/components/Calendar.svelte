<script lang="ts">
  import { entriesByDate } from '$lib/stores/entries';
  import { openModal } from '$lib/stores/ui';
  import DayCell from './DayCell.svelte';

  let currentDate = $state(new Date());

  let year = $derived(currentDate.getFullYear());
  let month = $derived(currentDate.getMonth());
  let monthName = $derived(currentDate.toLocaleString('default', { month: 'long' }));

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  let daysInMonth = $derived(new Date(year, month + 1, 0).getDate());
  let firstDayOfMonth = $derived(new Date(year, month, 1).getDay());

  let calendarDays = $derived(Array.from({ length: 42 }, (_, i) => {
    const dayNum = i - firstDayOfMonth + 1;
    if (dayNum < 1 || dayNum > daysInMonth) return null;
    return dayNum;
  }));

  function formatDate(day: number): string {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  function prevMonth() {
    currentDate = new Date(year, month - 1, 1);
  }

  function nextMonth() {
    currentDate = new Date(year, month + 1, 1);
  }

  function goToToday() {
    currentDate = new Date();
  }

  function isToday(day: number): boolean {
    const today = new Date();
    return day === today.getDate() &&
           month === today.getMonth() &&
           year === today.getFullYear();
  }

  function isFuture(day: number): boolean {
    const date = new Date(year, month, day);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date > today;
  }
</script>

<div class="bg-(--color-bg-card) rounded-3xl p-6 shadow-md border border-(--color-border-light) max-sm:p-4 max-sm:rounded-2xl">
  <header class="flex items-center justify-between mb-6 max-sm:mb-4">
    <button class="w-11 h-11 flex items-center justify-center rounded-full text-(--color-text-muted) transition-all duration-150 hover:bg-(--color-bg-hover) hover:text-(--color-text) max-sm:w-9 max-sm:h-9" onclick={prevMonth} aria-label="Previous month">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M15 18l-6-6 6-6"/>
      </svg>
    </button>

    <div class="flex items-center gap-4 max-sm:flex-col max-sm:gap-2">
      <h2 class="text-[1.75rem] font-semibold text-(--color-text) m-0 max-sm:text-xl">{monthName} {year}</h2>
      <button class="px-4 py-1 text-sm font-medium text-(--color-primary) bg-(--color-primary)/10 rounded-full transition-all duration-150 hover:bg-(--color-primary)/20 max-sm:px-3 max-sm:text-xs" onclick={goToToday}>Today</button>
    </div>

    <button class="w-11 h-11 flex items-center justify-center rounded-full text-(--color-text-muted) transition-all duration-150 hover:bg-(--color-bg-hover) hover:text-(--color-text) max-sm:w-9 max-sm:h-9" onclick={nextMonth} aria-label="Next month">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M9 18l6-6-6-6"/>
      </svg>
    </button>
  </header>

  <div class="grid grid-cols-7 gap-1 mb-2">
    {#each weekDays as day}
      <div class="text-center text-xs font-semibold text-(--color-text-muted) uppercase tracking-wider p-2 max-sm:text-[0.65rem] max-sm:p-1">{day}</div>
    {/each}
  </div>

  <div class="grid grid-cols-7 gap-1 max-sm:gap-0.5">
    {#each calendarDays as day, i}
      {#if day === null}
        <div class="aspect-square"></div>
      {:else}
        {@const dateStr = formatDate(day)}
        {@const entry = $entriesByDate.get(dateStr)}
        {@const dayIsFuture = isFuture(day)}
        <DayCell
          {day}
          {entry}
          isToday={isToday(day)}
          isFuture={dayIsFuture}
          onclick={() => !dayIsFuture && openModal(dateStr)}
        />
      {/if}
    {/each}
  </div>
</div>
