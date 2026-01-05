import { db } from './db';
import { dailyEntries, healthIssues } from './db/schema';
import { eq, desc, gte, lte, and } from 'drizzle-orm';

export type EntryInput = {
  date: string;
  stressLevel?: number | null;
  workedOut?: boolean;
  workoutType?: string | null;
  workoutNotes?: string | null;
  notes?: string | null;
  healthIssues?: Array<{
    issueType: string;
    severity?: number | null;
    notes?: string | null;
    timeOfDay?: string | null;
  }>;
};

export function getEntryByDate(date: string) {
  return db.query.dailyEntries.findFirst({
    where: eq(dailyEntries.date, date),
    with: { healthIssues: true }
  }).sync();
}

export function getEntries(options: {
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
} = {}) {
  const { startDate, endDate, limit = 30, offset = 0 } = options;

  const conditions = [];
  if (startDate) conditions.push(gte(dailyEntries.date, startDate));
  if (endDate) conditions.push(lte(dailyEntries.date, endDate));

  return db.query.dailyEntries.findMany({
    where: conditions.length > 0 ? and(...conditions) : undefined,
    with: { healthIssues: true },
    orderBy: [desc(dailyEntries.date)],
    limit: Math.min(limit, 100),
    offset
  }).sync();
}

export function createEntry(data: EntryInput) {
  const { healthIssues: issues, ...entryData } = data;

  const result = db.insert(dailyEntries).values({
    date: entryData.date,
    stressLevel: entryData.stressLevel,
    workedOut: entryData.workedOut ?? false,
    workoutType: entryData.workoutType,
    workoutNotes: entryData.workoutNotes,
    notes: entryData.notes
  }).returning().all();

  const entry = result[0];

  if (issues && issues.length > 0) {
    db.insert(healthIssues).values(
      issues.map(issue => ({
        dailyEntryId: entry.id,
        issueType: issue.issueType,
        severity: issue.severity,
        notes: issue.notes,
        timeOfDay: issue.timeOfDay
      }))
    ).run();
  }

  return getEntryByDate(data.date);
}

export function updateEntry(date: string, data: Partial<EntryInput>) {
  const existing = getEntryByDate(date);
  if (!existing) return null;

  const { healthIssues: issues, ...entryData } = data;

  // Update entry fields
  if (Object.keys(entryData).length > 0) {
    db.update(dailyEntries)
      .set({
        ...entryData,
        updatedAt: new Date().toISOString()
      })
      .where(eq(dailyEntries.date, date))
      .run();
  }

  // Replace health issues if provided
  if (issues !== undefined) {
    db.delete(healthIssues).where(eq(healthIssues.dailyEntryId, existing.id)).run();

    if (issues.length > 0) {
      db.insert(healthIssues).values(
        issues.map(issue => ({
          dailyEntryId: existing.id,
          issueType: issue.issueType,
          severity: issue.severity,
          notes: issue.notes,
          timeOfDay: issue.timeOfDay
        }))
      ).run();
    }
  }

  return getEntryByDate(date);
}

export function deleteEntry(date: string) {
  const existing = getEntryByDate(date);
  if (!existing) return false;

  db.delete(dailyEntries).where(eq(dailyEntries.date, date)).run();
  return true;
}

export function getTodayEntry() {
  const today = new Date().toISOString().split('T')[0];
  return getEntryByDate(today);
}
