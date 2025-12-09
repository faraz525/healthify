<script lang="ts">
  interface Props {
    label: string;
    value: string | number;
    icon?: string;
    color?: 'primary' | 'success' | 'warning' | 'danger';
  }

  let { label, value, icon = '', color = 'primary' }: Props = $props();
</script>

<div class="stats-card stats-{color}">
  {#if icon}
    <span class="stats-icon">{icon}</span>
  {/if}
  <div class="stats-content">
    <span class="stats-value">{value}</span>
    <span class="stats-label">{label}</span>
  </div>
</div>

<style>
  .stats-card {
    display: flex;
    align-items: center;
    gap: var(--space-md);
    padding: var(--space-lg);
    background: var(--color-bg-card);
    border-radius: var(--radius-lg);
    border: 1px solid var(--color-border-light);
    box-shadow: var(--shadow-sm);
  }

  .stats-icon {
    font-size: 2rem;
    width: 56px;
    height: 56px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--radius-md);
    background: var(--color-bg);
  }

  .stats-primary .stats-icon { background: rgba(var(--color-primary-rgb), 0.1); }
  .stats-success .stats-icon { background: var(--color-success-light); }
  .stats-warning .stats-icon { background: var(--color-warning-light); }
  .stats-danger .stats-icon { background: var(--color-danger-light); }

  .stats-content {
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
  }

  .stats-value {
    font-family: var(--font-display);
    font-size: 1.75rem;
    font-weight: 600;
    color: var(--color-text);
    line-height: 1;
  }

  .stats-label {
    font-size: 0.875rem;
    color: var(--color-text-muted);
  }
</style>
