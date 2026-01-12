<script lang="ts">
  import { enhance } from '$app/forms';
  import type { ActionData } from './$types';

  let { form }: { form: ActionData } = $props();
  let loading = $state(false);
</script>

<svelte:head>
  <title>Sign Up - Healthify</title>
</svelte:head>

<div class="signup-container">
  <div class="signup-card">
    <div class="signup-header">
      <span class="logo-icon">🌿</span>
      <h1>Create Account</h1>
      <p>Start tracking your health journey</p>
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
          placeholder="At least 8 characters"
          required
          autocomplete="new-password"
          minlength="8"
        />
      </div>

      <div class="form-group">
        <label for="confirmPassword">Confirm Password</label>
        <input
          type="password"
          id="confirmPassword"
          name="confirmPassword"
          placeholder="Confirm your password"
          required
          autocomplete="new-password"
        />
      </div>

      <button type="submit" class="signup-btn" disabled={loading}>
        {#if loading}
          Creating account...
        {:else}
          Create Account
        {/if}
      </button>
    </form>

    <div class="login-link">
      Already have an account? <a href="/login">Sign in</a>
    </div>
  </div>
</div>

<style>
  .signup-container {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--space-lg);
    background: var(--color-bg);
  }

  .signup-card {
    width: 100%;
    max-width: 400px;
    padding: var(--space-2xl);
    background: var(--color-bg-card);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-lg);
  }

  .signup-header {
    text-align: center;
    margin-bottom: var(--space-xl);
  }

  .logo-icon {
    font-size: 3rem;
    display: block;
    margin-bottom: var(--space-md);
  }

  .signup-header h1 {
    font-family: var(--font-display);
    font-size: 1.5rem;
    font-weight: 600;
    color: var(--color-text);
    margin-bottom: var(--space-xs);
  }

  .signup-header p {
    color: var(--color-text-muted);
    font-size: 0.9rem;
  }

  .error-message {
    background: rgba(220, 53, 69, 0.1);
    color: #dc3545;
    padding: var(--space-md);
    border-radius: var(--radius-md);
    margin-bottom: var(--space-lg);
    text-align: center;
    font-size: 0.9rem;
  }

  .form-group {
    margin-bottom: var(--space-lg);
  }

  .form-group label {
    display: block;
    font-weight: 500;
    margin-bottom: var(--space-xs);
    color: var(--color-text);
  }

  .form-group input {
    width: 100%;
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

  .form-group input::placeholder {
    color: var(--color-text-muted);
  }

  .signup-btn {
    width: 100%;
    padding: var(--space-md) var(--space-lg);
    background: var(--color-primary);
    color: white;
    border: none;
    border-radius: var(--radius-md);
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .signup-btn:hover:not(:disabled) {
    background: var(--color-primary-dark);
    transform: translateY(-1px);
  }

  .signup-btn:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }

  .login-link {
    text-align: center;
    margin-top: var(--space-lg);
    color: var(--color-text-muted);
    font-size: 0.9rem;
  }

  .login-link a {
    color: var(--color-primary);
    font-weight: 500;
  }

  .login-link a:hover {
    text-decoration: underline;
  }
</style>
