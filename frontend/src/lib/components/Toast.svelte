<script lang="ts">
  import { toastMessage } from '$lib/stores/ui';

  $: toast = $toastMessage;

  function getIcon(type: string): string {
    switch (type) {
      case 'success': return '✓';
      case 'error': return '✕';
      default: return 'ℹ';
    }
  }
</script>

{#if toast}
  <div class="toast toast-{toast.type} animate-slide-up">
    <span class="toast-icon">{getIcon(toast.type)}</span>
    <span class="toast-text">{toast.text}</span>
  </div>
{/if}

<style>
  .toast {
    position: fixed;
    bottom: var(--space-xl);
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    padding: var(--space-md) var(--space-lg);
    border-radius: var(--radius-full);
    background: var(--color-text);
    color: white;
    font-weight: 500;
    box-shadow: var(--shadow-lg);
    z-index: 200;
  }

  .toast-success {
    background: var(--color-success);
  }

  .toast-error {
    background: var(--color-danger);
  }

  .toast-icon {
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 255, 255, 0.2);
    border-radius: var(--radius-full);
    font-size: 0.75rem;
  }

  .toast-text {
    font-size: 0.95rem;
  }
</style>
