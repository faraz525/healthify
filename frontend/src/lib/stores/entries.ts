import { writable, derived } from 'svelte/store';
import { api, type DailyEntry } from '$lib/api';

function createEntriesStore() {
  const { subscribe, set, update } = writable<DailyEntry[]>([]);
  const loading = writable(false);
  const error = writable<string | null>(null);

  return {
    subscribe,
    loading,
    error,

    async load(startDate?: string, endDate?: string) {
      loading.set(true);
      error.set(null);
      try {
        const entries = await api.getEntries({ start_date: startDate, end_date: endDate, limit: 100 });
        set(entries);
      } catch (e) {
        error.set(e instanceof Error ? e.message : 'Failed to load entries');
      } finally {
        loading.set(false);
      }
    },

    async create(entry: Omit<DailyEntry, 'id' | 'created_at' | 'updated_at'>) {
      loading.set(true);
      error.set(null);
      try {
        const newEntry = await api.createEntry(entry);
        update(entries => [newEntry, ...entries]);
        return newEntry;
      } catch (e) {
        error.set(e instanceof Error ? e.message : 'Failed to create entry');
        throw e;
      } finally {
        loading.set(false);
      }
    },

    async update(date: string, entry: Partial<DailyEntry>) {
      loading.set(true);
      error.set(null);
      try {
        const updated = await api.updateEntry(date, entry);
        update(entries => entries.map(e => e.date === date ? updated : e));
        return updated;
      } catch (e) {
        error.set(e instanceof Error ? e.message : 'Failed to update entry');
        throw e;
      } finally {
        loading.set(false);
      }
    },

    async delete(date: string) {
      loading.set(true);
      error.set(null);
      try {
        await api.deleteEntry(date);
        update(entries => entries.filter(e => e.date !== date));
      } catch (e) {
        error.set(e instanceof Error ? e.message : 'Failed to delete entry');
        throw e;
      } finally {
        loading.set(false);
      }
    },

    getByDate(entries: DailyEntry[], date: string): DailyEntry | undefined {
      return entries.find(e => e.date === date);
    }
  };
}

export const entries = createEntriesStore();

// Derived store for entries indexed by date
export const entriesByDate = derived(entries, ($entries) => {
  const map = new Map<string, DailyEntry>();
  for (const entry of $entries) {
    map.set(entry.date, entry);
  }
  return map;
});
