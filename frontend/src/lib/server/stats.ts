import { db } from './db';
import { dailyEntries, healthIssues, issueTypes } from './db/schema';
import { gte, sql, desc, eq, and, lte } from 'drizzle-orm';

export interface MonthlyStats {
  month: string;
  year: number;
  workoutCount: number;
  avgStress: number | null;
  entryCount: number;
}

export interface CommonIssue {
  type: string;
  displayName: string;
  count: number;
}

export interface Stats {
  totalEntries: number;
  workoutDays: number;
  avgStress: number | null;
  commonIssues: CommonIssue[];
  streakDays: number;
  workoutStreak: number;
  monthlyBreakdown: MonthlyStats[];
}

export function getStats(userId: string, days = 30): Stats {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  const startDateStr = startDate.toISOString().split('T')[0];

  // Get entries in date range for this user
  const entries = db.query.dailyEntries.findMany({
    where: and(eq(dailyEntries.userId, userId), gte(dailyEntries.date, startDateStr)),
    with: { healthIssues: true }
  }).sync();

  const totalEntries = entries.length;
  const workoutDaysCount = entries.filter(e => e.workedOut).length;

  // Calculate average stress
  const stressLevels = entries
    .map(e => e.stressLevel)
    .filter((s): s is number => s !== null && s !== undefined);
  const avgStress = stressLevels.length > 0
    ? Math.round((stressLevels.reduce((a, b) => a + b, 0) / stressLevels.length) * 10) / 10
    : null;

  // Get common issues with display names
  const issueCountsResult = db
    .select({
      issueType: healthIssues.issueType,
      displayName: issueTypes.displayName,
      count: sql<number>`count(*)`.as('count')
    })
    .from(healthIssues)
    .innerJoin(dailyEntries, eq(healthIssues.dailyEntryId, dailyEntries.id))
    .leftJoin(issueTypes, eq(healthIssues.issueType, issueTypes.name))
    .where(and(eq(dailyEntries.userId, userId), gte(dailyEntries.date, startDateStr)))
    .groupBy(healthIssues.issueType)
    .orderBy(desc(sql`count(*)`))
    .limit(5)
    .all();

  const commonIssues: CommonIssue[] = issueCountsResult.map(r => ({
    type: r.issueType,
    displayName: r.displayName || r.issueType.replace(/_/g, ' '),
    count: r.count
  }));

  // Calculate entry streak (consecutive days with entries)
  const streakDays = calculateEntryStreak(userId);

  // Calculate workout streak (consecutive days worked out)
  const workoutStreak = calculateWorkoutStreak(userId);

  // Calculate monthly breakdown
  const monthlyBreakdown = calculateMonthlyBreakdown(userId, days);

  return {
    totalEntries,
    workoutDays: workoutDaysCount,
    avgStress,
    commonIssues,
    streakDays,
    workoutStreak,
    monthlyBreakdown
  };
}

function calculateEntryStreak(userId: string): number {
  // Get all entries for this user
  const allEntries = db.query.dailyEntries.findMany({
    where: eq(dailyEntries.userId, userId),
    orderBy: desc(dailyEntries.date)
  }).sync();

  const entryDates = new Set(allEntries.map(e => e.date));
  let streak = 0;
  const today = new Date();

  for (let i = 0; i < 365; i++) {
    const checkDate = new Date(today);
    checkDate.setDate(checkDate.getDate() - i);
    const dateStr = checkDate.toISOString().split('T')[0];

    if (entryDates.has(dateStr)) {
      streak++;
    } else {
      break;
    }
  }

  return streak;
}

function calculateWorkoutStreak(userId: string): number {
  // Get all entries for this user ordered by date descending
  const allEntries = db.query.dailyEntries.findMany({
    where: eq(dailyEntries.userId, userId),
    orderBy: desc(dailyEntries.date)
  }).sync();

  // Use Map for O(1) lookup instead of .find() which is O(n)
  const entriesByDate = new Map(allEntries.map(e => [e.date, e]));

  let streak = 0;
  const today = new Date();

  for (let i = 0; i < 365; i++) {
    const checkDate = new Date(today);
    checkDate.setDate(checkDate.getDate() - i);
    const dateStr = checkDate.toISOString().split('T')[0];

    const entry = entriesByDate.get(dateStr);

    if (entry && entry.workedOut) {
      streak++;
    } else if (entry && !entry.workedOut) {
      // Entry exists but no workout - streak broken
      break;
    } else {
      // No entry for this day - streak broken
      break;
    }
  }

  return streak;
}

function calculateMonthlyBreakdown(userId: string, days: number): MonthlyStats[] {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  const startDateStr = startDate.toISOString().split('T')[0];

  // Get all entries in the range for this user
  const entries = db.query.dailyEntries.findMany({
    where: and(eq(dailyEntries.userId, userId), gte(dailyEntries.date, startDateStr))
  }).sync();

  // Group by month
  const monthlyMap = new Map<string, { workouts: number; stressSum: number; stressCount: number; entries: number }>();

  for (const entry of entries) {
    const date = new Date(entry.date);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

    if (!monthlyMap.has(key)) {
      monthlyMap.set(key, { workouts: 0, stressSum: 0, stressCount: 0, entries: 0 });
    }

    const monthData = monthlyMap.get(key)!;
    monthData.entries++;

    if (entry.workedOut) {
      monthData.workouts++;
    }

    if (entry.stressLevel !== null && entry.stressLevel !== undefined) {
      monthData.stressSum += entry.stressLevel;
      monthData.stressCount++;
    }
  }

  // Convert to array and sort by date
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  return Array.from(monthlyMap.entries())
    .map(([key, data]) => {
      const [year, month] = key.split('-').map(Number);
      return {
        month: monthNames[month - 1],
        year,
        workoutCount: data.workouts,
        avgStress: data.stressCount > 0
          ? Math.round((data.stressSum / data.stressCount) * 10) / 10
          : null,
        entryCount: data.entries
      };
    })
    .sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      return monthNames.indexOf(a.month) - monthNames.indexOf(b.month);
    });
}
