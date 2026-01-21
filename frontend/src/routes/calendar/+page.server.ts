import type { PageServerLoad, Actions } from './$types';
import { fail } from '@sveltejs/kit';
import { getEntries, getEntryByDate, createEntry, updateEntry, deleteEntry, getTodayEntry } from '$lib/server/entries';
import { getStats } from '$lib/server/stats';
import { getWorkoutRoutines, getWorkouts } from '$lib/server/workouts';

export const load: PageServerLoad = async ({ parent, locals }) => {
  // Get entries from layout (already loaded for all pages)
  const parentData = await parent();

  if (!locals.user) {
    return {
      entries: [],
      todayEntry: null,
      stats: null,
      workoutRoutines: [],
      workouts: []
    };
  }

  const userId = locals.user.id;
  const todayEntry = getTodayEntry(userId);
  const stats = getStats(userId, 7);

  // Get workout routines for the EntryModal workout type selector
  const workoutRoutines = getWorkoutRoutines(userId, true);
  // Also get standalone workouts (workoutDays with userId but no routineId)
  const workouts = getWorkouts(userId);

  return {
    entries: parentData.entries,
    todayEntry,
    stats,
    workoutRoutines,
    workouts
  };
};

export const actions: Actions = {
  createEntry: async ({ request, locals }) => {
    if (!locals.user) return fail(401, { error: 'Not authenticated' });

    const userId = locals.user.id;
    const formData = await request.formData();

    let data;
    try {
      data = JSON.parse(formData.get('data') as string);
    } catch {
      return fail(400, { error: 'Invalid data format' });
    }

    // Check if entry already exists
    const existing = getEntryByDate(userId, data.date);
    if (existing) {
      return fail(400, { error: 'Entry already exists for this date' });
    }

    const entry = createEntry(userId, data);
    return { success: true, entry };
  },

  updateEntry: async ({ request, locals }) => {
    if (!locals.user) return fail(401, { error: 'Not authenticated' });

    const userId = locals.user.id;
    const formData = await request.formData();
    const date = formData.get('date') as string;

    let data;
    try {
      data = JSON.parse(formData.get('data') as string);
    } catch {
      return fail(400, { error: 'Invalid data format' });
    }

    const entry = updateEntry(userId, date, data);
    if (!entry) {
      return fail(404, { error: 'Entry not found' });
    }

    return { success: true, entry };
  },

  deleteEntry: async ({ request, locals }) => {
    if (!locals.user) return fail(401, { error: 'Not authenticated' });

    const userId = locals.user.id;
    const formData = await request.formData();
    const date = formData.get('date') as string;

    const deleted = deleteEntry(userId, date);
    if (!deleted) {
      return fail(404, { error: 'Entry not found' });
    }

    return { success: true };
  }
};
