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

<div class="card flex items-center gap-4 p-6">
  {#if icon}
    <span class="text-3xl w-14 h-14 flex items-center justify-center rounded-xl {bgColorMap[color]}">{iconMap[icon] || icon}</span>
  {/if}
  <div class="flex flex-col gap-1 min-w-0 overflow-hidden">
    <span class="font-(family-name:--font-display) text-3xl font-semibold text-(--color-text) leading-none overflow-hidden text-ellipsis whitespace-nowrap">{value}</span>
    <span class="text-sm text-(--color-text-muted) overflow-hidden text-ellipsis whitespace-nowrap">{label}</span>
  </div>
</div>
