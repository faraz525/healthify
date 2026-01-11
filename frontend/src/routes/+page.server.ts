import type { PageServerLoad, Actions } from './$types';
import { fail } from '@sveltejs/kit';
import { getEntries, getEntryByDate, createEntry, updateEntry, deleteEntry, getTodayEntry } from '$lib/server/entries';
import { getStats } from '$lib/server/stats';
import { getWorkoutRoutines } from '$lib/server/workouts';

export const load: PageServerLoad = async ({ parent }) => {
  // Get entries from layout (already loaded for all pages)
  const parentData = await parent();

  const todayEntry = getTodayEntry();
  const stats = getStats(7);

  // Get workout routines for the EntryModal workout type selector
  const workoutRoutines = getWorkoutRoutines(true);

  return {
    entries: parentData.entries,
    todayEntry,
    stats,
    workoutRoutines
  };
};

export const actions: Actions = {
  createEntry: async ({ request }) => {
    const formData = await request.formData();
    const data = JSON.parse(formData.get('data') as string);

    // Check if entry already exists
    const existing = getEntryByDate(data.date);
    if (existing) {
      return fail(400, { error: 'Entry already exists for this date' });
    }

    const entry = createEntry(data);
    return { success: true, entry };
  },

  updateEntry: async ({ request }) => {
    const formData = await request.formData();
    const date = formData.get('date') as string;
    const data = JSON.parse(formData.get('data') as string);

    const entry = updateEntry(date, data);
    if (!entry) {
      return fail(404, { error: 'Entry not found' });
    }

    return { success: true, entry };
  },

  deleteEntry: async ({ request }) => {
    const formData = await request.formData();
    const date = formData.get('date') as string;

    const deleted = deleteEntry(date);
    if (!deleted) {
      return fail(404, { error: 'Entry not found' });
    }

    return { success: true };
  }
};
