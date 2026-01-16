<script lang="ts">
  import { enhance } from '$app/forms';
  import type { ActionData } from './$types';

  let { form }: { form: ActionData } = $props();
  let loading = $state(false);
</script>

<svelte:head>
  <title>Login - Healthify</title>
</svelte:head>

<div class="login-container">
  <div class="login-card">
    <div class="login-header">
      <span class="logo-icon">🌿</span>
      <h1>Welcome to Healthify</h1>
      <p>Sign in to track your health journey</p>
    </div>

    {#if form?.error}
      <div class="error-message">
        {form.error}
      </div>
    {/if}

    <form
      method="POST"
      use:enhance={() => {
        loading = true;
        return async ({ update }) => {
          loading = false;
          await update();
        };
      }}
    >
      <div class="form-group">
        <label for="email">Email</label>
        <input
          type="email"
          id="email"
          name="email"
          value={form?.email ?? ''}
          placeholder="you@example.com"
          required
          autocomplete="email"
        />
      </div>

      <div class="form-group">
        <label for="password">Password</label>
        <input
          type="password"
          id="password"
          name="password"
          placeholder="Your password"
          required
          autocomplete="current-password"
        />
      </div>

      <button type="submit" class="login-btn" disabled={loading}>
        {#if loading}
          Signing in...
        {:else}
          Sign In
        {/if}
      </button>
    </form>

    <div class="signup-link">
      Don't have an account? <a href="/signup">Sign up</a>
    </div>
  </div>
</div>

<style>
  .login-container {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1.5rem;
    background: var(--color-bg);
  }

  .login-card {
    width: 100%;
    max-width: 400px;
    padding: 2rem;
    background: var(--color-bg-card);
    border-radius: 1.5rem;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
  }

  .login-header {
    text-align: center;
    margin-bottom: 2rem;
  }

  .logo-icon {
    font-size: 3rem;
    display: block;
    margin-bottom: 1rem;
  }

  .login-header h1 {
    font-family: var(--font-display);
    font-size: 1.75rem;
    font-weight: 700;
    color: var(--color-text);
    margin-bottom: 0.5rem;
  }

  .login-header p {
    color: var(--color-text-muted);
    font-size: 1rem;
  }

  .error-message {
    background: rgba(220, 53, 69, 0.1);
    color: #dc3545;
    padding: 1rem;
    border-radius: 0.75rem;
    margin-bottom: 1.5rem;
    text-align: center;
    font-size: 0.9rem;
  }

  .form-group {
    margin-bottom: 1.25rem;
  }

  .form-group label {
    display: block;
    font-weight: 600;
    font-size: 0.9rem;
    margin-bottom: 0.5rem;
    color: var(--color-text);
  }

  .form-group input {
    width: 100%;
    padding: 0.875rem 1rem;
    border: 1px solid var(--color-border);
    border-radius: 0.75rem;
    font-size: 1rem;
    background: var(--color-bg);
    color: var(--color-text);
    transition: border-color 0.15s ease;
  }

  .form-group input:focus {
    outline: none;
    border-color: var(--color-primary);
  }

  .form-group input::placeholder {
    color: var(--color-text-muted);
  }

  .login-btn {
    width: 100%;
    padding: 1rem 1.5rem;
    margin-top: 0.5rem;
    background: var(--color-primary);
    color: white;
    border: none;
    border-radius: 0.75rem;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .login-btn:hover:not(:disabled) {
    opacity: 0.9;
    transform: translateY(-1px);
  }

  .login-btn:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }

  .signup-link {
    text-align: center;
    margin-top: 1.5rem;
    color: var(--color-text-muted);
    font-size: 0.9rem;
  }

  .signup-link a {
    color: var(--color-primary);
    font-weight: 600;
  }

  .signup-link a:hover {
    text-decoration: underline;
  }
</style>
