import type { LayoutServerLoad } from './$types';
import { getIssueTypes } from '$lib/server/issueTypes';
import { getEntries } from '$lib/server/entries';
import { getWorkoutRoutines } from '$lib/server/workouts';
import { seedDefaultIssueTypes } from '$lib/server/db';

// Seed on first request
let seeded = false;

export const load: LayoutServerLoad = async ({ locals }) => {
  if (!seeded) {
    seedDefaultIssueTypes();
    seeded = true;
  }

  // If not logged in, return empty data (login page will handle)
  if (!locals.user) {
    return {
      user: null,
      issueTypes: [],
      entries: [],
      workoutRoutines: []
    };
  }

  const userId = locals.user.id;
  const issueTypes = getIssueTypes();

  // Load entries for 3 month range (used by calendar)
  const now = new Date();
  const startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0];
  const endDate = new Date(now.getFullYear(), now.getMonth() + 3, 0).toISOString().split('T')[0];
  const entries = getEntries(userId, { startDate, endDate, limit: 100 });

  // Load workout routines (used by EntryModal on all pages)
  const workoutRoutines = getWorkoutRoutines(userId);

  return {
    user: locals.user,
    issueTypes,
    entries,
    workoutRoutines
  };
};
