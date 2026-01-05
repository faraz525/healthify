import type { PageServerLoad } from './$types';
import { getStats } from '$lib/server/stats';

export const load: PageServerLoad = async ({ url }) => {
  const days = parseInt(url.searchParams.get('days') || '30');
  const validDays = Math.min(Math.max(days, 1), 365);

  const stats = getStats(validDays);

  return {
    stats,
    period: validDays
  };
};
