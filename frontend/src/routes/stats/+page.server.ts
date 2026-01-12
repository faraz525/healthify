import type { PageServerLoad } from './$types';
import { getStats, type Stats, type MonthlyStats, type CommonIssue } from '$lib/server/stats';

export type { Stats, MonthlyStats, CommonIssue };

export const load: PageServerLoad = async ({ url, locals }) => {
  if (!locals.user) {
    return {
      stats: null,
      period: 30
    };
  }

  const userId = locals.user.id;
  const days = parseInt(url.searchParams.get('days') || '30');
  const validDays = Math.min(Math.max(days, 1), 365);

  const stats = getStats(userId, validDays);

  return {
    stats,
    period: validDays
  };
};
