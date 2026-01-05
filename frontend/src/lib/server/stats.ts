import { db } from './db';
import { dailyEntries, healthIssues } from './db/schema';
import { gte, sql, desc, eq } from 'drizzle-orm';

export function getStats(days = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  const startDateStr = startDate.toISOString().split('T')[0];

  // Get entries in date range
  const entries = db.query.dailyEntries.findMany({
    where: gte(dailyEntries.date, startDateStr),
    with: { healthIssues: true }
  }).sync();

  const totalEntries = entries.length;
  const workoutDays = entries.filter(e => e.workedOut).length;

  // Calculate average stress
  const stressLevels = entries
    .map(e => e.stressLevel)
    .filter((s): s is number => s !== null && s !== undefined);
  const avgStress = stressLevels.length > 0
    ? Math.round((stressLevels.reduce((a, b) => a + b, 0) / stressLevels.length) * 10) / 10
    : null;

  // Get common issues
  const issueCountsResult = db
    .select({
      issueType: healthIssues.issueType,
      count: sql<number>`count(*)`.as('count')
    })
    .from(healthIssues)
    .innerJoin(dailyEntries, eq(healthIssues.dailyEntryId, dailyEntries.id))
    .where(gte(dailyEntries.date, startDateStr))
    .groupBy(healthIssues.issueType)
    .orderBy(desc(sql`count(*)`))
    .limit(5)
    .all();

  const commonIssues = issueCountsResult.map(r => ({
    type: r.issueType,
    count: r.count
  }));

  // Calculate streak
  let streakDays = 0;
  const today = new Date();
  const entryDates = new Set(entries.map(e => e.date));

  for (let i = 0; i < 365; i++) {
    const checkDate = new Date(today);
    checkDate.setDate(checkDate.getDate() - i);
    const dateStr = checkDate.toISOString().split('T')[0];

    if (entryDates.has(dateStr)) {
      streakDays++;
    } else {
      break;
    }
  }

  return {
    totalEntries,
    workoutDays,
    avgStress,
    commonIssues,
    streakDays
  };
}
