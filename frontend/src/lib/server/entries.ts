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

export function getEntryByDate(userId: string, date: string) {
  try {
    return db.query.dailyEntries.findFirst({
      where: and(eq(dailyEntries.userId, userId), eq(dailyEntries.date, date)),
      with: { healthIssues: true }
    }).sync();
  } catch (err) {
    console.error('Failed to get entry by date:', err);
    return undefined;
  }
}

export function getEntries(userId: string, options: {
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
} = {}) {
  try {
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
  } catch (err) {
    console.error('Failed to get entries:', err);
    return [];
  }
}

export function createEntry(userId: string, data: EntryInput) {
  try {
    const { healthIssues: issues, ...entryData } = data;

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
    if (!entry) {
      console.error('Failed to create entry: No result returned');
      return null;
    }

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

    return getEntryByDate(userId, data.date);
  } catch (err) {
    console.error('Failed to create entry:', err);
    return null;
  }
}

export function updateEntry(userId: string, date: string, data: Partial<EntryInput>) {
  try {
    const existing = getEntryByDate(userId, date);
    if (!existing) return null;

    const { healthIssues: issues, ...entryData } = data;

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

    return getEntryByDate(userId, date);
  } catch (err) {
    console.error('Failed to update entry:', err);
    return null;
  }
}

export function deleteEntry(userId: string, date: string) {
  try {
    const existing = getEntryByDate(userId, date);
    if (!existing) return false;

    db.delete(dailyEntries).where(and(eq(dailyEntries.userId, userId), eq(dailyEntries.date, date))).run();
    return true;
  } catch (err) {
    console.error('Failed to delete entry:', err);
    return false;
  }
}

export function getTodayEntry(userId: string) {
  const today = new Date().toISOString().split('T')[0];
  return getEntryByDate(userId, today);
}
