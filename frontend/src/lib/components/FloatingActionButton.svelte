<script lang="ts">
  import { openModal } from '$lib/stores/ui';

  function logToday() {
    const today = new Date().toISOString().split('T')[0];
    openModal(today);
  }
</script>

<button
  class="fixed bottom-[calc(2rem+env(safe-area-inset-bottom,0px))] right-6 w-14 h-14 rounded-full bg-(--color-primary) text-white shadow-[0_4px_16px_rgba(198,123,92,0.4)] z-40 flex items-center justify-center transition-all duration-150 hover:scale-110 hover:shadow-[0_6px_24px_rgba(198,123,92,0.5)] active:scale-95 sm:hidden"
  onclick={logToday}
  aria-label="Log today's entry"
  title="Log today"
>
  <svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M12 5v14M5 12h14"/>
  </svg>
</button>
