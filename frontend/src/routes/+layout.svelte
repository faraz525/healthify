<script lang="ts">
  import '../app.css';
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { entries } from '$lib/stores/entries';
  import { issueTypes } from '$lib/stores/issueTypes';
  import { modalOpen, showToast } from '$lib/stores/ui';
  import { auth, isAuthenticated, currentUser } from '$lib/stores/auth';
  import { authApi, setAccessToken } from '$lib/api';
  import Toast from '$lib/components/Toast.svelte';
  import EntryModal from '$lib/components/EntryModal.svelte';

  let { children } = $props();
  let loaded = $state(false);
  let mobileMenuOpen = $state(false);

  // Check if current page is the login page
  let isLoginPage = $derived($page.url.pathname === '/login');

  onMount(async () => {
    // Try to restore auth from localStorage
    const storedToken = localStorage.getItem('accessToken');

    if (storedToken) {
      setAccessToken(storedToken);
      try {
        const user = await authApi.getMe();
        auth.setAuth(user, storedToken);
      } catch {
        // Token invalid, try refresh
        try {
          const response = await authApi.refresh();
          setAccessToken(response.access_token);
          auth.setAuth(response.user, response.access_token);
        } catch {
          // Refresh failed, clear auth
          auth.clearAuth();
          if (!isLoginPage) {
            loaded = true;
            goto('/login');
            return;
          }
        }
      }
    } else {
      // No stored token, try refresh from cookie
      try {
        const response = await authApi.refresh();
        setAccessToken(response.access_token);
        auth.setAuth(response.user, response.access_token);
      } catch {
        // No valid session
        auth.setInitialized();
        if (!isLoginPage) {
          loaded = true;
          goto('/login');
          return;
        }
      }
    }

    // If on login page and authenticated, redirect to home
    if (isLoginPage && $isAuthenticated) {
      goto('/');
      return;
    }

    // If authenticated, load data
    if ($isAuthenticated) {
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
    }

    loaded = true;
  });

  function toggleMenu() {
    mobileMenuOpen = !mobileMenuOpen;
  }

  function closeMenu() {
    mobileMenuOpen = false;
  }

  async function handleLogout() {
    try {
      await authApi.logout();
    } catch {
      // Ignore logout errors
    }
    setAccessToken(null);
    auth.clearAuth();
    showToast('Logged out');
    goto('/login');
  }
</script>

<svelte:head>
  <title>Healthify</title>
  <meta name="description" content="Personal health tracker" />
</svelte:head>

<div class="app">
  {#if !isLoginPage}
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
          {#if $isAuthenticated}
            <button class="nav-link logout-btn" onclick={handleLogout}>
              Logout
            </button>
          {/if}
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
          {#if $isAuthenticated}
            <button class="mobile-nav-link logout-btn-mobile" onclick={() => { closeMenu(); handleLogout(); }}>
              Logout ({$currentUser?.email})
            </button>
          {/if}
        </nav>
      {/if}
    </header>
  {/if}

  <main class="app-main" class:login-page={isLoginPage}>
    {#if loaded}
      {@render children()}
    {:else}
      <div class="loading">
        <div class="loading-spinner"></div>
        <p>Loading...</p>
      </div>
    {/if}
  </main>

  {#if !isLoginPage}
    <footer class="app-footer">
      <div class="container">
        <p>Track your health, one day at a time.</p>
      </div>
    </footer>
  {/if}
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
    align-items: center;
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

  .logout-btn {
    background: none;
    border: none;
    cursor: pointer;
    font-size: inherit;
  }

  .logout-btn:hover {
    color: var(--color-danger, #dc2626);
    background: var(--color-danger-bg, #fef2f2);
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

  .logout-btn-mobile {
    background: none;
    border: none;
    border-bottom: 1px solid var(--color-border-light);
    cursor: pointer;
    font-size: inherit;
    text-align: left;
    width: 100%;
  }

  .logout-btn-mobile:last-child {
    border-bottom: none;
  }

  .logout-btn-mobile:hover {
    color: var(--color-danger, #dc2626);
  }

  .app-main {
    flex: 1;
    padding: var(--space-2xl) 0;
  }

  .app-main.login-page {
    padding: 0;
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

    .app-main.login-page {
      padding: 0;
    }
  }
</style>
