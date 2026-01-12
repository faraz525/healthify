<script lang="ts">
  import '../app.css';
  import { page } from '$app/stores';
  import { enhance } from '$app/forms';
  import { modalOpen } from '$lib/stores/ui';
  import { issueTypes } from '$lib/stores/issueTypes';
  import { entries } from '$lib/stores/entries';
  import Toast from '$lib/components/Toast.svelte';
  import EntryModal from '$lib/components/EntryModal.svelte';
  import FloatingActionButton from '$lib/components/FloatingActionButton.svelte';
  import type { LayoutData } from './$types';

  let { children, data }: { children: any; data: LayoutData } = $props();
  let mobileMenuOpen = $state(false);

  // Sync layout data to stores
  $effect(() => {
    if (data.issueTypes) issueTypes.set(data.issueTypes);
    if (data.entries) entries.set(data.entries);
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

<div class="min-h-screen flex flex-col overflow-x-hidden">
  <header class="bg-(--color-bg-card) border-b border-(--color-border-light) sticky top-0 z-50">
    <div class="container flex items-center justify-between h-18 max-sm:h-15">
      <a href="/" class="flex items-center gap-2 no-underline">
        <span class="text-3xl max-sm:text-2xl">🌿</span>
        <span class="font-(family-name:--font-display) text-2xl max-sm:text-xl font-semibold text-(--color-text)">Healthify</span>
      </a>

      <!-- Desktop Navigation -->
      <nav class="hidden sm:flex items-center gap-4">
        <a
          href="/"
          class="px-4 py-2 font-medium text-(--color-text-muted) rounded-lg transition-all duration-150 hover:text-(--color-text) hover:bg-(--color-bg-hover) {$page.url.pathname === '/' ? 'text-(--color-primary)!' : ''}"
        >Workouts</a>
        <a
          href="/calendar"
          class="px-4 py-2 font-medium text-(--color-text-muted) rounded-lg transition-all duration-150 hover:text-(--color-text) hover:bg-(--color-bg-hover) {$page.url.pathname === '/calendar' ? 'text-(--color-primary)!' : ''}"
        >Calendar</a>
        <a
          href="/stats"
          class="px-4 py-2 font-medium text-(--color-text-muted) rounded-lg transition-all duration-150 hover:text-(--color-text) hover:bg-(--color-bg-hover) {$page.url.pathname === '/stats' ? 'text-(--color-primary)!' : ''}"
        >Stats</a>
        {#if data.user}
          <div class="flex items-center gap-4 ml-6 pl-6 border-l border-(--color-border-light)">
            <span class="text-sm text-(--color-text-muted)">{data.user.email.split('@')[0]}</span>
            <form action="/logout" method="POST" use:enhance>
              <button type="submit" class="px-4 py-1 text-sm font-medium text-(--color-text-muted) bg-transparent border border-(--color-border) rounded-lg cursor-pointer transition-all duration-150 hover:text-(--color-text) hover:border-(--color-text-muted)">Logout</button>
            </form>
          </div>
        {/if}
      </nav>

      <!-- Mobile Hamburger Button -->
      <button
        class="flex sm:hidden flex-col justify-center gap-[5px] w-11 h-11 p-2.5 bg-transparent border-none cursor-pointer"
        onclick={toggleMenu}
        aria-label="Toggle menu"
        aria-expanded={mobileMenuOpen}
      >
        <span class="w-6 h-0.5 bg-(--color-text) rounded-sm transition-all duration-150 {mobileMenuOpen ? 'rotate-45 translate-x-[5px] translate-y-[5px]' : ''}"></span>
        <span class="w-6 h-0.5 bg-(--color-text) rounded-sm transition-all duration-150 {mobileMenuOpen ? 'opacity-0' : ''}"></span>
        <span class="w-6 h-0.5 bg-(--color-text) rounded-sm transition-all duration-150 {mobileMenuOpen ? '-rotate-45 translate-x-[5px] -translate-y-[5px]' : ''}"></span>
      </button>
    </div>

    <!-- Mobile Navigation Menu -->
    {#if mobileMenuOpen}
      <nav class="flex sm:hidden flex-col px-6 pb-6 border-t border-(--color-border-light) bg-(--color-bg-card)">
        <a href="/" class="py-4 px-2 font-medium text-(--color-text-muted) border-b border-(--color-border-light) transition-all duration-150 hover:text-(--color-primary)" onclick={closeMenu}>Workouts</a>
        <a href="/calendar" class="py-4 px-2 font-medium text-(--color-text-muted) border-b border-(--color-border-light) transition-all duration-150 hover:text-(--color-primary)" onclick={closeMenu}>Calendar</a>
        <a href="/stats" class="py-4 px-2 font-medium text-(--color-text-muted) transition-all duration-150 hover:text-(--color-primary)" onclick={closeMenu}>Stats</a>
        {#if data.user}
          <div class="flex flex-col gap-2 py-4 px-2 mt-2 border-t border-(--color-border-light)">
            <span class="text-sm text-(--color-text-muted)">{data.user.email}</span>
            <form action="/logout" method="POST" use:enhance>
              <button type="submit" class="w-full py-2 px-4 text-sm font-medium text-(--color-text) bg-(--color-bg-hover) border-none rounded-lg cursor-pointer text-center" onclick={closeMenu}>Logout</button>
            </form>
          </div>
        {/if}
      </nav>
    {/if}
  </header>

  <main class="flex-1 py-12 max-sm:py-6">
    {@render children()}
  </main>

  <footer class="py-8 text-center text-(--color-text-muted) text-sm">
    <div class="container">
      <p>Track your health, one day at a time.</p>
    </div>
  </footer>
</div>

{#if $modalOpen}
  <EntryModal />
{/if}

<Toast />

{#if !$modalOpen}
  <FloatingActionButton />
{/if}
