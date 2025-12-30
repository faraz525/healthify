<script lang="ts">
  import { goto } from '$app/navigation';
  import { authApi, setAccessToken } from '$lib/api';
  import { auth } from '$lib/stores/auth';
  import { showToast } from '$lib/stores/ui';

  let email = $state('');
  let password = $state('');
  let isLoading = $state(false);
  let isSignup = $state(false);
  let error = $state('');

  async function handleSubmit(e: Event) {
    e.preventDefault();
    if (!email || !password) return;

    error = '';
    isLoading = true;

    try {
      const response = isSignup
        ? await authApi.signup(email, password)
        : await authApi.login(email, password);

      setAccessToken(response.access_token);
      auth.setAuth(response.user, response.access_token);
      showToast(isSignup ? 'Account created!' : 'Welcome back!');
      goto('/');
    } catch (e) {
      error = e instanceof Error ? e.message : 'Authentication failed';
    } finally {
      isLoading = false;
    }
  }

  function toggleMode() {
    isSignup = !isSignup;
    error = '';
  }
</script>

<svelte:head>
  <title>{isSignup ? 'Sign Up' : 'Log In'} - Healthify</title>
</svelte:head>

<div class="auth-page">
  <div class="auth-card">
    <div class="auth-header">
      <span class="auth-icon">🌿</span>
      <h1>{isSignup ? 'Create Account' : 'Welcome Back'}</h1>
      <p class="auth-subtitle">
        {isSignup ? 'Start tracking your health journey' : 'Sign in to continue'}
      </p>
    </div>

    <form onsubmit={handleSubmit} class="auth-form">
      {#if error}
        <div class="error-message">{error}</div>
      {/if}

      <div class="form-group">
        <label for="email">Email</label>
        <input
          type="email"
          id="email"
          bind:value={email}
          placeholder="you@example.com"
          required
          disabled={isLoading}
        />
      </div>

      <div class="form-group">
        <label for="password">Password</label>
        <input
          type="password"
          id="password"
          bind:value={password}
          placeholder={isSignup ? 'At least 6 characters' : 'Your password'}
          minlength="6"
          required
          disabled={isLoading}
        />
      </div>

      <button type="submit" class="submit-btn" disabled={isLoading}>
        {#if isLoading}
          <span class="loading-spinner"></span>
          {isSignup ? 'Creating account...' : 'Signing in...'}
        {:else}
          {isSignup ? 'Sign Up' : 'Log In'}
        {/if}
      </button>
    </form>

    <div class="auth-footer">
      <p>
        {isSignup ? 'Already have an account?' : "Don't have an account?"}
        <button type="button" class="toggle-btn" onclick={toggleMode} disabled={isLoading}>
          {isSignup ? 'Log In' : 'Sign Up'}
        </button>
      </p>
    </div>
  </div>
</div>

<style>
  .auth-page {
    min-height: calc(100vh - 200px);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--space-lg);
  }

  .auth-card {
    width: 100%;
    max-width: 400px;
    background: var(--color-bg-card);
    border: 1px solid var(--color-border-light);
    border-radius: var(--radius-lg);
    padding: var(--space-2xl);
  }

  .auth-header {
    text-align: center;
    margin-bottom: var(--space-xl);
  }

  .auth-icon {
    font-size: 3rem;
    display: block;
    margin-bottom: var(--space-md);
  }

  .auth-header h1 {
    font-family: var(--font-display);
    font-size: 1.75rem;
    font-weight: 600;
    color: var(--color-text);
    margin-bottom: var(--space-xs);
  }

  .auth-subtitle {
    color: var(--color-text-muted);
    font-size: 0.9375rem;
  }

  .auth-form {
    display: flex;
    flex-direction: column;
    gap: var(--space-lg);
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
  }

  .form-group label {
    font-weight: 500;
    color: var(--color-text);
    font-size: 0.875rem;
  }

  .form-group input {
    padding: var(--space-md);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    font-size: 1rem;
    background: var(--color-bg);
    color: var(--color-text);
    transition: border-color var(--transition-fast);
  }

  .form-group input:focus {
    outline: none;
    border-color: var(--color-primary);
  }

  .form-group input:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .error-message {
    background: var(--color-danger-bg, #fef2f2);
    color: var(--color-danger, #dc2626);
    padding: var(--space-md);
    border-radius: var(--radius-md);
    font-size: 0.875rem;
    text-align: center;
  }

  .submit-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-sm);
    width: 100%;
    padding: var(--space-md) var(--space-lg);
    background: var(--color-primary);
    color: white;
    border: none;
    border-radius: var(--radius-md);
    font-size: 1rem;
    font-weight: 500;
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .submit-btn:hover:not(:disabled) {
    background: var(--color-primary-dark, #059669);
  }

  .submit-btn:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }

  .loading-spinner {
    width: 18px;
    height: 18px;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-top-color: white;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .auth-footer {
    margin-top: var(--space-xl);
    text-align: center;
    color: var(--color-text-muted);
    font-size: 0.875rem;
  }

  .toggle-btn {
    background: none;
    border: none;
    color: var(--color-primary);
    font-weight: 500;
    cursor: pointer;
    text-decoration: underline;
  }

  .toggle-btn:hover {
    color: var(--color-primary-dark, #059669);
  }

  .toggle-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  @media (max-width: 480px) {
    .auth-card {
      padding: var(--space-xl);
    }

    .auth-header h1 {
      font-size: 1.5rem;
    }
  }
</style>
