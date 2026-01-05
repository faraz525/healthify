import { writable, derived } from 'svelte/store';

export interface DailyEntry {
  id: number;
  date: string;
  stressLevel: number | null;
  workedOut: boolean | null;
  workoutNotes: string | null;
  notes: string | null;
  healthIssues: Array<{
    id: number;
    issueType: string;
    severity: number | null;
    notes: string | null;
    timeOfDay: string | null;
  }>;
}

// Simple writable store - data is loaded from server via +page.server.ts
export const entries = writable<DailyEntry[]>([]);

// Derived store for entries indexed by date
export const entriesByDate = derived(entries, ($entries) => {
  const map = new Map<string, DailyEntry>();
  for (const entry of $entries) {
    map.set(entry.date, entry);
  }
  return map;
});
