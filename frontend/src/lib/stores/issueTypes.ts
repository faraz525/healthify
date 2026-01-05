import { writable } from 'svelte/store';

export interface IssueType {
  id: number;
  name: string;
  displayName: string;
  icon: string | null;
  isActive: boolean | null;
  sortOrder: number | null;
}

// Simple writable store - data is loaded from server via +layout.server.ts
export const issueTypes = writable<IssueType[]>([]);
