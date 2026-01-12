<script lang="ts">
  // Define local types instead of importing from API
  interface HealthIssue {
    issueType: string;
    severity: number | null;
    notes: string | null;
    timeOfDay: string | null;
  }

  interface IssueType {
    id: number;
    name: string;
    displayName: string;
    icon: string | null;
    isActive: boolean | null;
    sortOrder: number | null;
  }

  interface Props {
    issues: HealthIssue[];
    issueTypes: IssueType[];
  }

  let { issues = $bindable(), issueTypes }: Props = $props();

  let customIssue = $state('');
  let showCustomInput = $state(false);

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

  function isSelected(issueTypeName: string): boolean {
    return issues.some(i => i.issueType === issueTypeName);
  }

  function toggleIssue(issueType: IssueType) {
    const index = issues.findIndex(i => i.issueType === issueType.name);
    if (index >= 0) {
      issues = issues.filter((_, i) => i !== index);
    } else {
      issues = [...issues, {
        issueType: issueType.name,
        severity: null,
        notes: null,
        timeOfDay: null
      }];
    }
  }

  function addCustomIssue() {
    if (!customIssue.trim()) return;

    const name = customIssue.toLowerCase().replace(/\s+/g, '_');
    if (!issues.some(i => i.issueType === name)) {
      issues = [...issues, {
        issueType: name,
        severity: null,
        notes: customIssue.trim(),
        timeOfDay: null
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

<div class="flex flex-col gap-4">
  <div class="grid grid-cols-3 gap-2 max-sm:grid-cols-2 max-sm:gap-1">
    {#each issueTypes as type}
      <button
        class="flex flex-col items-center gap-1 p-4 rounded-xl bg-(--color-bg) border-2 border-(--color-border) transition-all duration-150 hover:border-(--color-warning) hover:bg-(--color-warning-light) max-sm:min-h-14 max-sm:p-2
          {isSelected(type.name) ? 'border-(--color-warning) bg-(--color-warning-light)' : ''}"
        onclick={() => toggleIssue(type)}
      >
        <span class="text-2xl max-sm:text-xl">{getIcon(type.icon)}</span>
        <span class="text-xs font-medium text-(--color-text-muted) text-center {isSelected(type.name) ? 'text-(--color-text)' : ''} max-sm:text-[0.7rem]">{type.displayName}</span>
      </button>
    {/each}
  </div>

  {#if issues.length > 0}
    <div class="flex flex-wrap gap-2">
      {#each issues as issue, index}
        <div class="flex items-center gap-2 px-3 py-1 bg-(--color-warning-light) rounded-full text-sm text-(--color-text) capitalize">
          <span>{issue.notes || issue.issueType.replace(/_/g, ' ')}</span>
          <button class="flex items-center justify-center w-5 h-5 rounded-full text-(--color-text-muted) transition-all duration-150 hover:bg-(--color-danger-light) hover:text-(--color-danger) max-sm:w-7 max-sm:h-7" onclick={() => removeIssue(index)} aria-label="Remove">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>
      {/each}
    </div>
  {/if}

  {#if showCustomInput}
    <div class="flex gap-2 animate-slide-up max-sm:flex-wrap">
      <input
        type="text"
        bind:value={customIssue}
        placeholder="Describe the issue..."
        onkeydown={handleCustomKeydown}
        class="flex-1 px-4 py-2 border border-(--color-border) rounded-lg text-[0.95rem] focus:outline-none focus:border-(--color-primary) max-sm:w-full max-sm:min-h-11"
      />
      <button class="btn btn-primary max-sm:flex-1 max-sm:min-h-11" onclick={addCustomIssue}>Add</button>
      <button class="btn btn-secondary max-sm:flex-1 max-sm:min-h-11" onclick={() => { showCustomInput = false; customIssue = ''; }}>
        Cancel
      </button>
    </div>
  {:else}
    <button class="flex items-center gap-2 px-4 py-2 text-(--color-primary) font-medium rounded-lg transition-all duration-150 hover:bg-(--color-primary)/10 max-sm:min-h-11 max-sm:justify-center" onclick={() => showCustomInput = true}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 5v14M5 12h14"/>
      </svg>
      Add custom issue
    </button>
  {/if}
</div>
