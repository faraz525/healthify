<script lang="ts">
  import '../app.css';
  import { onMount } from 'svelte';
  import { entries } from '$lib/stores/entries';
  import { issueTypes } from '$lib/stores/issueTypes';
  import { modalOpen } from '$lib/stores/ui';
  import Toast from '$lib/components/Toast.svelte';
  import EntryModal from '$lib/components/EntryModal.svelte';

  let { children } = $props();
  let loaded = $state(false);

  onMount(async () => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 2, 0);

    await Promise.all([
      entries.load(
        startOfMonth.toISOString().split('T')[0],
        endOfMonth.toISOString().split('T')[0]
      ),
      issueTypes.load()
    ]);
    loaded = true;
  });
</script>

<svelte:head>
  <title>Healthify</title>
  <meta name="description" content="Personal health tracker" />
</svelte:head>

<div class="app">
  <header class="app-header">
    <div class="container header-content">
      <a href="/" class="logo">
        <span class="logo-icon">🌿</span>
        <span class="logo-text">Healthify</span>
      </a>
      <nav class="nav">
        <a href="/" class="nav-link">Calendar</a>
        <a href="/stats" class="nav-link">Stats</a>
      </nav>
    </div>
  </header>

  <main class="app-main">
    {#if loaded}
      {@render children()}
    {:else}
      <div class="loading">
        <div class="loading-spinner"></div>
        <p>Loading...</p>
      </div>
    {/if}
  </main>

  <footer class="app-footer">
    <div class="container">
      <p>Track your health, one day at a time.</p>
    </div>
  </footer>
</div>

{#if $modalOpen}
  <EntryModal />
{/if}

<Toast />

<style>
  .app {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
  }

  .app-header {
    background: var(--color-bg-card);
    border-bottom: 1px solid var(--color-border-light);
    position: sticky;
    top: 0;
    z-index: 50;
  }

  .header-content {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 72px;
  }

  .logo {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    text-decoration: none;
  }

  .logo-icon {
    font-size: 1.75rem;
  }

  .logo-text {
    font-family: var(--font-display);
    font-size: 1.5rem;
    font-weight: 600;
    color: var(--color-text);
  }

  .nav {
    display: flex;
    gap: var(--space-md);
  }

  .nav-link {
    padding: var(--space-sm) var(--space-md);
    font-weight: 500;
    color: var(--color-text-muted);
    border-radius: var(--radius-sm);
    transition: all var(--transition-fast);
  }

  .nav-link:hover {
    color: var(--color-text);
    background: var(--color-bg-hover);
  }

  .app-main {
    flex: 1;
    padding: var(--space-2xl) 0;
  }

  .app-footer {
    padding: var(--space-xl) 0;
    text-align: center;
    color: var(--color-text-muted);
    font-size: 0.875rem;
  }

  .loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--space-md);
    padding: var(--space-2xl);
    color: var(--color-text-muted);
  }

  .loading-spinner {
    width: 40px;
    height: 40px;
    border: 3px solid var(--color-border);
    border-top-color: var(--color-primary);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }
</style>
