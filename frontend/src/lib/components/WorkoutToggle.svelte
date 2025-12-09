<script lang="ts">
  export let checked = false;
</script>

<button
  class="workout-toggle"
  class:active={checked}
  on:click={() => checked = !checked}
  role="switch"
  aria-checked={checked}
>
  <div class="toggle-icon">
    <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.57 14.86L22 13.43 20.57 12 17 15.57 8.43 7 12 3.43 10.57 2 9.14 3.43 7.71 2 5.57 4.14 4.14 2.71 2.71 4.14l1.43 1.43L2 7.71l1.43 1.43L2 10.57 3.43 12 7 8.43 15.57 17 12 20.57 13.43 22l1.43-1.43L16.29 22l2.14-2.14 1.43 1.43 1.43-1.43-1.43-1.43L22 16.29z"/>
    </svg>
  </div>
  <span class="toggle-label">{checked ? 'Yes! 💪' : 'No workout'}</span>
</button>

<style>
  .workout-toggle {
    display: flex;
    align-items: center;
    gap: var(--space-md);
    padding: var(--space-md) var(--space-lg);
    border-radius: var(--radius-lg);
    background: var(--color-bg);
    border: 2px solid var(--color-border);
    transition: all var(--transition-base);
    width: 100%;
  }

  .workout-toggle:hover {
    border-color: var(--color-success);
  }

  .workout-toggle.active {
    background: var(--color-success-light);
    border-color: var(--color-success);
  }

  .toggle-icon {
    width: 48px;
    height: 48px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--radius-full);
    background: var(--color-bg-card);
    color: var(--color-text-muted);
    transition: all var(--transition-base);
  }

  .workout-toggle.active .toggle-icon {
    background: var(--color-success);
    color: white;
    animation: bounce 0.5s ease;
  }

  .toggle-label {
    font-size: 1.125rem;
    font-weight: 500;
    color: var(--color-text-muted);
    transition: color var(--transition-fast);
  }

  .workout-toggle.active .toggle-label {
    color: var(--color-success);
  }

  @keyframes bounce {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.15); }
  }
</style>
