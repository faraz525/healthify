<script lang="ts">
  interface Props {
    checked: boolean;
  }

  let { checked = $bindable() }: Props = $props();
</script>

<button
  class="flex items-center gap-4 px-6 py-4 rounded-xl w-full border-2 transition-all duration-250 {checked ? 'bg-(--color-success-light) border-(--color-success)' : 'bg-(--color-bg) border-(--color-border) hover:border-(--color-success)'}"
  onclick={() => checked = !checked}
  role="switch"
  aria-checked={checked}
>
  <div class="w-12 h-12 flex items-center justify-center rounded-full transition-all duration-250 {checked ? 'bg-(--color-success) text-white animate-bounce' : 'bg-(--color-bg-card) text-(--color-text-muted)'}">
    <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.57 14.86L22 13.43 20.57 12 17 15.57 8.43 7 12 3.43 10.57 2 9.14 3.43 7.71 2 5.57 4.14 4.14 2.71 2.71 4.14l1.43 1.43L2 7.71l1.43 1.43L2 10.57 3.43 12 7 8.43 15.57 17 12 20.57 13.43 22l1.43-1.43L16.29 22l2.14-2.14 1.43 1.43 1.43-1.43-1.43-1.43L22 16.29z"/>
    </svg>
  </div>
  <span class="text-lg font-medium transition-colors duration-150 {checked ? 'text-(--color-success)' : 'text-(--color-text-muted)'}">{checked ? 'Yes!' : 'No workout'}</span>
</button>
