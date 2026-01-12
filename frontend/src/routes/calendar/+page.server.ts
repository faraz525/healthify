import type { PageServerLoad, Actions } from './$types';
import { fail } from '@sveltejs/kit';
import { getEntries, getEntryByDate, createEntry, updateEntry, deleteEntry, getTodayEntry } from '$lib/server/entries';
import { getStats } from '$lib/server/stats';
import { getWorkoutRoutines } from '$lib/server/workouts';

export const load: PageServerLoad = async ({ parent, locals }) => {
  // Get entries from layout (already loaded for all pages)
  const parentData = await parent();

  if (!locals.user) {
    return {
      entries: [],
      todayEntry: null,
      stats: null,
      workoutRoutines: []
    };
  }

  const userId = locals.user.id;
  const todayEntry = getTodayEntry(userId);
  const stats = getStats(userId, 7);

  // Get workout routines for the EntryModal workout type selector
  const workoutRoutines = getWorkoutRoutines(userId, true);

  return {
    entries: parentData.entries,
    todayEntry,
    stats,
    workoutRoutines
  };
};

export const actions: Actions = {
  createEntry: async ({ request, locals }) => {
    if (!locals.user) return fail(401, { error: 'Not authenticated' });

    const userId = locals.user.id;
    const formData = await request.formData();
    const data = JSON.parse(formData.get('data') as string);

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
    const data = JSON.parse(formData.get('data') as string);

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
