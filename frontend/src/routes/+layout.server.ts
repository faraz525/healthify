import type { LayoutServerLoad } from './$types';
import { getIssueTypes } from '$lib/server/issueTypes';
import { getEntries } from '$lib/server/entries';
import { getWorkoutRoutines } from '$lib/server/workouts';
import { seedDefaultIssueTypes } from '$lib/server/db';

// Seed on first request
let seeded = false;

export const load: LayoutServerLoad = async () => {
  if (!seeded) {
    seedDefaultIssueTypes();
    seeded = true;
  }

  const issueTypes = getIssueTypes();

  // Load entries for 3 month range (used by calendar)
  const now = new Date();
  const startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0];
  const endDate = new Date(now.getFullYear(), now.getMonth() + 3, 0).toISOString().split('T')[0];
  const entries = getEntries({ startDate, endDate, limit: 100 });

  // Load workout routines (used by EntryModal on all pages)
  const workoutRoutines = getWorkoutRoutines();

  return {
    issueTypes,
    entries,
    workoutRoutines
  };
};
