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
  let mobileMenuOpen = $state(false);

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

  function toggleMenu() {
    mobileMenuOpen = !mobileMenuOpen;
  }

  function closeMenu() {
    mobileMenuOpen = false;
  }
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

      <!-- Desktop Navigation -->
      <nav class="nav desktop-nav">
        <a href="/" class="nav-link">Calendar</a>
        <a href="/workouts" class="nav-link">Workouts</a>
        <a href="/stats" class="nav-link">Stats</a>
      </nav>

      <!-- Mobile Hamburger Button -->
      <button
        class="hamburger-btn"
        onclick={toggleMenu}
        aria-label="Toggle menu"
        aria-expanded={mobileMenuOpen}
      >
        <span class="hamburger-line" class:open={mobileMenuOpen}></span>
        <span class="hamburger-line" class:open={mobileMenuOpen}></span>
        <span class="hamburger-line" class:open={mobileMenuOpen}></span>
      </button>
    </div>

    <!-- Mobile Navigation Menu -->
    {#if mobileMenuOpen}
      <nav class="mobile-nav">
        <a href="/" class="mobile-nav-link" onclick={closeMenu}>Calendar</a>
        <a href="/workouts" class="mobile-nav-link" onclick={closeMenu}>Workouts</a>
        <a href="/stats" class="mobile-nav-link" onclick={closeMenu}>Stats</a>
      </nav>
    {/if}
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
    overflow-x: hidden;
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

  /* Desktop Navigation */
  .desktop-nav {
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

  /* Hamburger Button - Hidden on desktop */
  .hamburger-btn {
    display: none;
    flex-direction: column;
    justify-content: center;
    gap: 5px;
    width: 44px;
    height: 44px;
    padding: 10px;
    background: transparent;
    border: none;
    cursor: pointer;
  }

  .hamburger-line {
    width: 24px;
    height: 2px;
    background: var(--color-text);
    border-radius: 2px;
    transition: all var(--transition-fast);
  }

  .hamburger-line.open:nth-child(1) {
    transform: rotate(45deg) translate(5px, 5px);
  }

  .hamburger-line.open:nth-child(2) {
    opacity: 0;
  }

  .hamburger-line.open:nth-child(3) {
    transform: rotate(-45deg) translate(5px, -5px);
  }

  /* Mobile Navigation - Hidden by default */
  .mobile-nav {
    display: none;
    flex-direction: column;
    padding: 0 var(--space-lg) var(--space-lg);
    border-top: 1px solid var(--color-border-light);
    background: var(--color-bg-card);
  }

  .mobile-nav-link {
    padding: var(--space-md) var(--space-sm);
    font-weight: 500;
    color: var(--color-text-muted);
    border-bottom: 1px solid var(--color-border-light);
    transition: all var(--transition-fast);
  }

  .mobile-nav-link:last-child {
    border-bottom: none;
  }

  .mobile-nav-link:hover {
    color: var(--color-primary);
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

  /* Mobile Responsive */
  @media (max-width: 600px) {
    .header-content {
      height: 60px;
    }

    .logo-icon {
      font-size: 1.5rem;
    }

    .logo-text {
      font-size: 1.25rem;
    }

    .desktop-nav {
      display: none;
    }

    .hamburger-btn {
      display: flex;
    }

    .mobile-nav {
      display: flex;
    }

    .app-main {
      padding: var(--space-lg) 0;
    }
  }
</style>
