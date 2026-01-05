import type { PageServerLoad, Actions } from './$types';
import { fail } from '@sveltejs/kit';
import { getEntries, getEntryByDate, createEntry, updateEntry, deleteEntry, getTodayEntry } from '$lib/server/entries';
import { getStats } from '$lib/server/stats';

export const load: PageServerLoad = async () => {
  // Load entries for 3 month range (1 month ago to 2 months ahead)
  const now = new Date();
  const startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0];
  const endDate = new Date(now.getFullYear(), now.getMonth() + 3, 0).toISOString().split('T')[0];

  const entries = getEntries({ startDate, endDate, limit: 100 });
  const todayEntry = getTodayEntry();
  const stats = getStats(7);

  return {
    entries,
    todayEntry,
    stats
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
