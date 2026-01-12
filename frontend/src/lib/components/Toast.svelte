<script lang="ts">
  import { toastMessage } from '$lib/stores/ui';

  let toast = $derived($toastMessage);

  function getIcon(type: string): string {
    switch (type) {
      case 'success': return '✓';
      case 'error': return '✕';
      default: return 'ℹ';
    }
  }
</script>

{#if toast}
  <div class="fixed bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-2 px-6 py-4 rounded-full font-medium shadow-xl z-200 animate-slide-up {toast.type === 'success' ? 'bg-(--color-success)' : toast.type === 'error' ? 'bg-(--color-danger)' : 'bg-(--color-text)'} text-white">
    <span class="w-5 h-5 flex items-center justify-center bg-white/20 rounded-full text-xs">{getIcon(toast.type)}</span>
    <span class="text-sm">{toast.text}</span>
  </div>
{/if}
