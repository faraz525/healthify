<script lang="ts">
  import type { HealthIssue, IssueType } from '$lib/api';

  export let issues: HealthIssue[] = [];
  export let issueTypes: IssueType[] = [];

  let customIssue = '';
  let showCustomInput = false;

  const iconMap: Record<string, string> = {
    heart: '❤️',
    brain: '🧠',
    'battery-low': '🔋',
    'alert-circle': '😰',
    stomach: '🫃',
    moon: '🌙',
    activity: '💪',
    compass: '🌀',
    'plus-circle': '➕'
  };

  function getIcon(icon: string | null): string {
    return icon ? (iconMap[icon] || '•') : '•';
  }

  function isSelected(issueType: string): boolean {
    return issues.some(i => i.issue_type === issueType);
  }

  function toggleIssue(issueType: IssueType) {
    const index = issues.findIndex(i => i.issue_type === issueType.name);
    if (index >= 0) {
      issues = issues.filter((_, i) => i !== index);
    } else {
      issues = [...issues, {
        issue_type: issueType.name,
        severity: null,
        notes: null,
        time_of_day: null
      }];
    }
  }

  function addCustomIssue() {
    if (!customIssue.trim()) return;

    const name = customIssue.toLowerCase().replace(/\s+/g, '_');
    if (!issues.some(i => i.issue_type === name)) {
      issues = [...issues, {
        issue_type: name,
        severity: null,
        notes: customIssue.trim(),
        time_of_day: null
      }];
    }
    customIssue = '';
    showCustomInput = false;
  }

  function removeIssue(index: number) {
    issues = issues.filter((_, i) => i !== index);
  }

  function handleCustomKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      addCustomIssue();
    } else if (e.key === 'Escape') {
      showCustomInput = false;
      customIssue = '';
    }
  }
</script>

<div class="issue-selector">
  <div class="issue-grid">
    {#each issueTypes as type}
      <button
        class="issue-btn"
        class:selected={isSelected(type.name)}
        on:click={() => toggleIssue(type)}
      >
        <span class="issue-icon">{getIcon(type.icon)}</span>
        <span class="issue-name">{type.display_name}</span>
      </button>
    {/each}
  </div>

  {#if issues.length > 0}
    <div class="selected-issues">
      {#each issues as issue, index}
        <div class="issue-badge">
          <span>{issue.notes || issue.issue_type.replace(/_/g, ' ')}</span>
          <button class="remove-btn" on:click={() => removeIssue(index)} aria-label="Remove">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>
      {/each}
    </div>
  {/if}

  {#if showCustomInput}
    <div class="custom-input animate-slide-up">
      <input
        type="text"
        bind:value={customIssue}
        placeholder="Describe the issue..."
        on:keydown={handleCustomKeydown}
        autofocus
      />
      <button class="btn btn-primary" on:click={addCustomIssue}>Add</button>
      <button class="btn btn-secondary" on:click={() => { showCustomInput = false; customIssue = ''; }}>
        Cancel
      </button>
    </div>
  {:else}
    <button class="add-custom-btn" on:click={() => showCustomInput = true}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 5v14M5 12h14"/>
      </svg>
      Add custom issue
    </button>
  {/if}
</div>

<style>
  .issue-selector {
    display: flex;
    flex-direction: column;
    gap: var(--space-md);
  }

  .issue-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: var(--space-sm);
  }

  .issue-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-xs);
    padding: var(--space-md);
    border-radius: var(--radius-md);
    background: var(--color-bg);
    border: 2px solid var(--color-border);
    transition: all var(--transition-fast);
  }

  .issue-btn:hover {
    border-color: var(--color-warning);
    background: var(--color-warning-light);
  }

  .issue-btn.selected {
    border-color: var(--color-warning);
    background: var(--color-warning-light);
  }

  .issue-icon {
    font-size: 1.5rem;
  }

  .issue-name {
    font-size: 0.75rem;
    font-weight: 500;
    color: var(--color-text-muted);
    text-align: center;
  }

  .issue-btn.selected .issue-name {
    color: var(--color-text);
  }

  .selected-issues {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-sm);
  }

  .issue-badge {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    padding: var(--space-xs) var(--space-sm);
    background: var(--color-warning-light);
    border-radius: var(--radius-full);
    font-size: 0.875rem;
    color: var(--color-text);
    text-transform: capitalize;
  }

  .remove-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    border-radius: var(--radius-full);
    color: var(--color-text-muted);
    transition: all var(--transition-fast);
  }

  .remove-btn:hover {
    background: var(--color-danger-light);
    color: var(--color-danger);
  }

  .custom-input {
    display: flex;
    gap: var(--space-sm);
  }

  .custom-input input {
    flex: 1;
    padding: var(--space-sm) var(--space-md);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    font-size: 0.95rem;
  }

  .custom-input input:focus {
    outline: none;
    border-color: var(--color-primary);
  }

  .add-custom-btn {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    padding: var(--space-sm) var(--space-md);
    color: var(--color-primary);
    font-weight: 500;
    border-radius: var(--radius-sm);
    transition: all var(--transition-fast);
  }

  .add-custom-btn:hover {
    background: rgba(var(--color-primary-rgb), 0.1);
  }
</style>
