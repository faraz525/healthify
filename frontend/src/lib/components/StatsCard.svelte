<script lang="ts">
  interface Props {
    label: string;
    value: string | number;
    icon?: string;
    color?: 'primary' | 'success' | 'warning' | 'danger';
  }

  let { label, value, icon = '', color = 'primary' }: Props = $props();

  const iconMap: Record<string, string> = {
    calendar: '📅',
    fire: '🔥',
    dumbbell: '💪',
    heart: '❤️'
  };

  const bgColorMap: Record<string, string> = {
    primary: 'bg-(--color-primary)/10',
    success: 'bg-(--color-success-light)',
    warning: 'bg-(--color-warning-light)',
    danger: 'bg-(--color-danger-light)'
  };
</script>

<div class="bg-(--color-bg-card) rounded-2xl border border-(--color-border-light) shadow-sm p-3 sm:p-4">
  <div class="flex items-center gap-3">
    {#if icon}
      <span class="text-xl sm:text-2xl w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center rounded-xl {bgColorMap[color]} shrink-0">{iconMap[icon] || icon}</span>
    {/if}
    <div class="flex flex-col min-w-0">
      <span class="font-(family-name:--font-display) text-xl sm:text-2xl font-bold text-(--color-text) leading-tight truncate">{value}</span>
      <span class="text-xs sm:text-sm text-(--color-text-muted) truncate">{label}</span>
    </div>
  </div>
</div>
