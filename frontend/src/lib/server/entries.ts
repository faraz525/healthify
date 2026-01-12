import { db, sqlite } from './db';
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

export function getEntryByDate(userId: string, date: string) {
  return db.query.dailyEntries.findFirst({
    where: and(eq(dailyEntries.userId, userId), eq(dailyEntries.date, date)),
    with: { healthIssues: true }
  }).sync();
}

export function getEntries(userId: string, options: {
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
} = {}) {
  const { startDate, endDate, limit = 30, offset = 0 } = options;

  const conditions = [eq(dailyEntries.userId, userId)];
  if (startDate) conditions.push(gte(dailyEntries.date, startDate));
  if (endDate) conditions.push(lte(dailyEntries.date, endDate));

  return db.query.dailyEntries.findMany({
    where: and(...conditions),
    with: { healthIssues: true },
    orderBy: [desc(dailyEntries.date)],
    limit: Math.min(limit, 100),
    offset
  }).sync();
}

// Uses a transaction to ensure atomic creation of entry and health issues
export function createEntry(userId: string, data: EntryInput) {
  const { healthIssues: issues, ...entryData } = data;

  // Use a transaction to atomically create entry and health issues
  const createEntryTx = sqlite.transaction(() => {
    const result = db.insert(dailyEntries).values({
      userId,
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

    return entry;
  });

  createEntryTx();
  return getEntryByDate(userId, data.date);
}

// Uses a transaction to ensure atomic update of entry and health issues
export function updateEntry(userId: string, date: string, data: Partial<EntryInput>) {
  const existing = getEntryByDate(userId, date);
  if (!existing) return null;

  const { healthIssues: issues, ...entryData } = data;

  // Use a transaction to atomically update entry fields and health issues
  const updateEntryTx = sqlite.transaction(() => {
    // Update entry fields
    if (Object.keys(entryData).length > 0) {
      db.update(dailyEntries)
        .set({
          ...entryData,
          updatedAt: new Date().toISOString()
        })
        .where(and(eq(dailyEntries.userId, userId), eq(dailyEntries.date, date)))
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
  });

  updateEntryTx();
  return getEntryByDate(userId, date);
}

export function deleteEntry(userId: string, date: string) {
  const existing = getEntryByDate(userId, date);
  if (!existing) return false;

  db.delete(dailyEntries).where(and(eq(dailyEntries.userId, userId), eq(dailyEntries.date, date))).run();
  return true;
}

export function getTodayEntry(userId: string) {
  const today = new Date().toISOString().split('T')[0];
  return getEntryByDate(userId, today);
}
