import { db } from './db';
import { workoutSessions, exerciseLogs, exercises, workoutDays, workoutRoutines } from './db/schema';
import { eq, and, desc, or } from 'drizzle-orm';
import { getEntryByDate, createEntry, updateEntry } from './entries';

export type WorkoutSession = typeof workoutSessions.$inferSelect;
export type ExerciseLog = typeof exerciseLogs.$inferSelect;

export interface ExerciseLogWithPR extends ExerciseLog {
  isNewPR?: boolean;
  previousBest?: { weight: string; reps: number } | null;
}

// Helper to verify workout ownership
function verifyWorkoutOwnership(userId: string, workoutDayId: number): boolean {
  const workout = db.query.workoutDays.findFirst({
    where: eq(workoutDays.id, workoutDayId),
    with: { routine: true }
  }).sync();

  if (!workout) return false;
  if (workout.userId === userId) return true;
  if (workout.routine && workout.routine.userId === userId) return true;
  return false;
}

// Get the active workout session for user (if any)
export function getActiveSession(userId: string) {
  const session = db.query.workoutSessions.findFirst({
    where: eq(workoutSessions.status, 'active'),
    with: {
      workoutDay: {
        with: { exercises: true, routine: true }
      },
      exerciseLogs: {
        with: { exercise: true }
      }
    }
  }).sync();

  // Verify ownership
  if (!session) return null;
  if (!verifyWorkoutOwnership(userId, session.workoutDayId)) return null;

  return session;
}

// Get a session by ID (with ownership check)
export function getSession(userId: string, sessionId: number) {
  const session = db.query.workoutSessions.findFirst({
    where: eq(workoutSessions.id, sessionId),
    with: {
      workoutDay: {
        with: { exercises: true, routine: true }
      },
      exerciseLogs: {
        with: { exercise: true }
      }
    }
  }).sync();

  if (!session) return null;
  if (!verifyWorkoutOwnership(userId, session.workoutDayId)) return null;

  return session;
}

// Start a new workout session for a workout day
export function startSession(userId: string, workoutDayId: number): WorkoutSession | null {
  // Verify ownership
  if (!verifyWorkoutOwnership(userId, workoutDayId)) return null;

  // Check if there's already an active session for this user
  const existing = getActiveSession(userId);
  if (existing) {
    return null; // Can't start a new session while one is active
  }

  const result = db.insert(workoutSessions).values({
    workoutDayId,
    status: 'active',
    startedAt: new Date().toISOString()
  }).returning().all();

  return result[0];
}

// Parse weight string to numeric value for comparison
function parseWeight(weightStr: string | null | undefined): number {
  if (!weightStr) return 0;
  const match = weightStr.match(/^(\d+(?:\.\d+)?)/);
  return match ? parseFloat(match[1]) : 0;
}

// Get the best previous log for an exercise (highest weight * reps combo)
export function getBestPreviousLog(exerciseId: number, excludeSessionId?: number, excludeLogId?: number): { weight: string; reps: number } | null {
  const logs = db.query.exerciseLogs.findMany({
    where: eq(exerciseLogs.exerciseId, exerciseId),
    orderBy: [desc(exerciseLogs.completedAt)]
  }).sync();

  let best: { weight: string; reps: number; score: number } | null = null;

  for (const log of logs) {
    if (excludeLogId && log.id === excludeLogId) continue;
    if (excludeSessionId && log.sessionId === excludeSessionId) continue;

    const weight = parseWeight(log.weight);
    const reps = log.reps ?? 0;
    const score = weight * reps;

    if (!best || score > best.score) {
      best = { weight: log.weight ?? '0', reps, score };
    }
  }

  return best ? { weight: best.weight, reps: best.reps } : null;
}

// Check if a new log is a PR compared to ALL previous logs
export function isPR(exerciseId: number, weight: string, reps: number, excludeLogId?: number): boolean {
  const best = getBestPreviousLog(exerciseId, undefined, excludeLogId);
  if (!best) return true;

  const newWeight = parseWeight(weight);
  const newScore = newWeight * reps;
  const bestScore = parseWeight(best.weight) * best.reps;

  return newScore > bestScore;
}

// Log an exercise set with weight and reps
export function logExerciseSet(
  userId: string,
  sessionId: number,
  exerciseId: number,
  setNumber: number,
  weight: string | null,
  reps: number | null
): ExerciseLogWithPR | null {
  // Verify session exists, is active, and belongs to user
  const session = getSession(userId, sessionId);
  if (!session || session.status !== 'active') return null;

  // Verify exercise exists
  const exercise = db.query.exercises.findFirst({
    where: eq(exercises.id, exerciseId)
  }).sync();

  if (!exercise) return null;

  const isNewPR = weight && reps ? isPR(exerciseId, weight, reps) : false;
  const previousBest = getBestPreviousLog(exerciseId, sessionId);

  const result = db.insert(exerciseLogs).values({
    sessionId,
    exerciseId,
    setNumber,
    weight,
    reps,
    isPR: isNewPR,
    completedAt: new Date().toISOString()
  }).returning().all();

  return {
    ...result[0],
    isNewPR,
    previousBest
  };
}

// Update an existing exercise log
export function updateExerciseLog(
  userId: string,
  logId: number,
  weight: string | null,
  reps: number | null
): ExerciseLogWithPR | null {
  const existing = db.query.exerciseLogs.findFirst({
    where: eq(exerciseLogs.id, logId)
  }).sync();

  if (!existing) return null;

  // Verify session ownership
  const session = getSession(userId, existing.sessionId);
  if (!session) return null;

  const isNewPR = weight && reps ? isPR(existing.exerciseId, weight, reps, existing.id) : false;
  const previousBest = getBestPreviousLog(existing.exerciseId, existing.sessionId);

  db.update(exerciseLogs)
    .set({
      weight,
      reps,
      isPR: isNewPR,
      completedAt: new Date().toISOString()
    })
    .where(eq(exerciseLogs.id, logId))
    .run();

  const updated = db.query.exerciseLogs.findFirst({
    where: eq(exerciseLogs.id, logId)
  }).sync();

  return updated ? { ...updated, isNewPR, previousBest } : null;
}

// Delete an exercise log
export function deleteExerciseLog(userId: string, logId: number): boolean {
  const existing = db.query.exerciseLogs.findFirst({
    where: eq(exerciseLogs.id, logId)
  }).sync();

  if (!existing) return false;

  // Verify session ownership
  const session = getSession(userId, existing.sessionId);
  if (!session) return false;

  db.delete(exerciseLogs).where(eq(exerciseLogs.id, logId)).run();
  return true;
}

// Complete the current workout session
export function completeSession(userId: string, sessionId: number, notes?: string): WorkoutSession | null {
  const session = getSession(userId, sessionId);
  if (!session || session.status !== 'active') return null;

  const completedAt = new Date().toISOString();

  db.update(workoutSessions)
    .set({
      status: 'completed',
      completedAt,
      notes: notes ?? session.notes
    })
    .where(eq(workoutSessions.id, sessionId))
    .run();

  // Auto-sync to daily calendar entry
  syncSessionToCalendar(userId, session, completedAt);

  return getSession(userId, sessionId) as WorkoutSession;
}

// Sync completed workout session to daily calendar entry
function syncSessionToCalendar(userId: string, session: any, completedAt: string): void {
  const sessionDate = session.startedAt.split('T')[0];
  const workoutSummary = generateWorkoutSummary(session, completedAt);
  const workoutType = session.workoutDay?.name ?? 'Workout';

  const existingEntry = getEntryByDate(userId, sessionDate);

  if (existingEntry) {
    updateEntry(userId, sessionDate, {
      workedOut: true,
      workoutType,
      workoutNotes: workoutSummary
    });
  } else {
    createEntry(userId, {
      date: sessionDate,
      workedOut: true,
      workoutType,
      workoutNotes: workoutSummary,
      healthIssues: []
    });
  }
}

// Generate human-readable workout summary
function generateWorkoutSummary(session: any, completedAt: string): string {
  const logs = session.exerciseLogs || [];

  const startTime = new Date(session.startedAt);
  const endTime = new Date(completedAt);
  const durationMins = Math.round((endTime.getTime() - startTime.getTime()) / 60000);

  const exerciseGroups: Record<string, any[]> = {};
  for (const log of logs) {
    const name = log.exercise?.name ?? 'Unknown';
    if (!exerciseGroups[name]) exerciseGroups[name] = [];
    exerciseGroups[name].push(log);
  }

  const lines: string[] = [`${durationMins} min session`];

  for (const [name, exLogs] of Object.entries(exerciseGroups)) {
    const sets = exLogs.length;
    const bestSet = exLogs.reduce((best, log) => {
      const score = (parseFloat(log.weight) || 0) * (log.reps || 0);
      const bestScore = (parseFloat(best.weight) || 0) * (best.reps || 0);
      return score > bestScore ? log : best;
    }, exLogs[0]);

    const prCount = exLogs.filter((l: any) => l.isPR).length;
    const prText = prCount > 0 ? ` (${prCount} PR${prCount > 1 ? 's' : ''})` : '';

    lines.push(`${name}: ${sets} sets, best ${bestSet.weight ?? '-'} x ${bestSet.reps ?? '-'}${prText}`);
  }

  return lines.join('\n');
}

// Cancel the current workout session
export function cancelSession(userId: string, sessionId: number): boolean {
  const session = getSession(userId, sessionId);
  if (!session || session.status !== 'active') return false;

  db.update(workoutSessions)
    .set({
      status: 'cancelled',
      completedAt: new Date().toISOString()
    })
    .where(eq(workoutSessions.id, sessionId))
    .run();

  return true;
}

// Get all PRs achieved in a session
export function getSessionPRs(userId: string, sessionId: number) {
  const session = getSession(userId, sessionId);
  if (!session) return [];

  return db.query.exerciseLogs.findMany({
    where: and(
      eq(exerciseLogs.sessionId, sessionId),
      eq(exerciseLogs.isPR, true)
    ),
    with: { exercise: true }
  }).sync();
}

// Get exercise history for a specific exercise
export function getExerciseHistory(userId: string, exerciseId: number, limit = 10) {
  // Verify exercise belongs to user's workout
  const exercise = db.query.exercises.findFirst({
    where: eq(exercises.id, exerciseId),
    with: { workoutDay: { with: { routine: true } } }
  }).sync();

  if (!exercise) return [];

  const workout = exercise.workoutDay;
  if (workout.userId !== userId && (!workout.routine || workout.routine.userId !== userId)) {
    return [];
  }

  return db.query.exerciseLogs.findMany({
    where: eq(exerciseLogs.exerciseId, exerciseId),
    orderBy: [desc(exerciseLogs.completedAt)],
    limit,
    with: { session: true }
  }).sync();
}

// Get logs for a specific exercise within a session
export function getExerciseLogsInSession(userId: string, sessionId: number, exerciseId: number) {
  const session = getSession(userId, sessionId);
  if (!session) return [];

  return db.query.exerciseLogs.findMany({
    where: and(
      eq(exerciseLogs.sessionId, sessionId),
      eq(exerciseLogs.exerciseId, exerciseId)
    ),
    orderBy: [exerciseLogs.setNumber]
  }).sync();
}
