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

<div class="calendar">
  <header class="calendar-header">
    <button class="nav-btn" onclick={prevMonth} aria-label="Previous month">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M15 18l-6-6 6-6"/>
      </svg>
    </button>

    <div class="month-year">
      <h2>{monthName} {year}</h2>
      <button class="today-btn" onclick={goToToday}>Today</button>
    </div>

    <button class="nav-btn" onclick={nextMonth} aria-label="Next month">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M9 18l6-6-6-6"/>
      </svg>
    </button>
  </header>

  <div class="weekdays">
    {#each weekDays as day}
      <div class="weekday">{day}</div>
    {/each}
  </div>

  <div class="days-grid">
    {#each calendarDays as day, i}
      {#if day === null}
        <div class="day-cell empty"></div>
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

<style>
  .calendar {
    background: var(--color-bg-card);
    border-radius: var(--radius-xl);
    padding: var(--space-xl);
    box-shadow: var(--shadow-md);
    border: 1px solid var(--color-border-light);
  }

  .calendar-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: var(--space-xl);
  }

  .month-year {
    display: flex;
    align-items: center;
    gap: var(--space-md);
  }

  .month-year h2 {
    font-size: 1.75rem;
    font-weight: 600;
    color: var(--color-text);
    margin: 0;
  }

  .nav-btn {
    width: 44px;
    height: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--radius-full);
    color: var(--color-text-muted);
    transition: all var(--transition-fast);
  }

  .nav-btn:hover {
    background: var(--color-bg-hover);
    color: var(--color-text);
  }

  .today-btn {
    padding: var(--space-xs) var(--space-md);
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--color-primary);
    background: rgba(var(--color-primary-rgb), 0.1);
    border-radius: var(--radius-full);
    transition: all var(--transition-fast);
  }

  .today-btn:hover {
    background: rgba(var(--color-primary-rgb), 0.2);
  }

  .weekdays {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: var(--space-xs);
    margin-bottom: var(--space-sm);
  }

  .weekday {
    text-align: center;
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--color-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    padding: var(--space-sm);
  }

  .days-grid {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: var(--space-xs);
  }

  .day-cell.empty {
    aspect-ratio: 1;
  }
</style>
