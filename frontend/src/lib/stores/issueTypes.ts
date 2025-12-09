import { writable } from 'svelte/store';
import { api, type IssueType } from '$lib/api';

function createIssueTypesStore() {
  const { subscribe, set } = writable<IssueType[]>([]);
  const loading = writable(false);

  return {
    subscribe,
    loading,

    async load() {
      loading.set(true);
      try {
        const types = await api.getIssueTypes();
        set(types);
      } catch (e) {
        console.error('Failed to load issue types:', e);
      } finally {
        loading.set(false);
      }
    },

    async create(issueType: { name: string; display_name: string; icon?: string }) {
      try {
        const newType = await api.createIssueType(issueType);
        set([...await api.getIssueTypes()]);
        return newType;
      } catch (e) {
        console.error('Failed to create issue type:', e);
        throw e;
      }
    }
  };
}

export const issueTypes = createIssueTypesStore();
