<script lang="ts">
  import { openModal } from '$lib/stores/ui';

  function logToday() {
    const today = new Date().toISOString().split('T')[0];
    openModal(today);
  }
</script>

<button
  class="fab"
  onclick={logToday}
  aria-label="Log today's entry"
  title="Log today"
>
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M12 5v14M5 12h14"/>
  </svg>
</button>

<style>
  .fab {
    position: fixed;
    bottom: calc(var(--space-xl) + env(safe-area-inset-bottom, 0px));
    right: var(--space-lg);
    width: 56px;
    height: 56px;
    border-radius: var(--radius-full);
    background: var(--color-primary);
    color: white;
    box-shadow: 0 4px 16px rgba(198, 123, 92, 0.4);
    z-index: 40;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: transform var(--transition-fast), box-shadow var(--transition-fast);
  }

  .fab:hover {
    transform: scale(1.1);
    box-shadow: 0 6px 24px rgba(198, 123, 92, 0.5);
  }

  .fab:active {
    transform: scale(0.95);
  }

  .fab svg {
    width: 24px;
    height: 24px;
  }

  /* Hide on desktop where calendar is easy to click */
  @media (min-width: 601px) {
    .fab {
      display: none;
    }
  }
</style>
