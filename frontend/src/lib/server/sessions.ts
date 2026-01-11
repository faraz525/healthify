import { db } from './db';
import { workoutSessions, exerciseLogs, exercises, workoutDays } from './db/schema';
import { eq, and, desc } from 'drizzle-orm';

export type WorkoutSession = typeof workoutSessions.$inferSelect;
export type ExerciseLog = typeof exerciseLogs.$inferSelect;

export interface ExerciseLogWithPR extends ExerciseLog {
  isNewPR?: boolean;
  previousBest?: { weight: string; reps: number } | null;
}

// Get the active workout session (if any)
export function getActiveSession() {
  return db.query.workoutSessions.findFirst({
    where: eq(workoutSessions.status, 'active'),
    with: {
      workoutDay: {
        with: { exercises: true }
      },
      exerciseLogs: {
        with: { exercise: true }
      }
    }
  }).sync();
}

// Get a session by ID
export function getSession(sessionId: number) {
  return db.query.workoutSessions.findFirst({
    where: eq(workoutSessions.id, sessionId),
    with: {
      workoutDay: {
        with: { exercises: true }
      },
      exerciseLogs: {
        with: { exercise: true }
      }
    }
  }).sync();
}

// Start a new workout session for a workout day
export function startSession(workoutDayId: number): WorkoutSession | null {
  // Check if there's already an active session
  const existing = getActiveSession();
  if (existing) {
    return null; // Can't start a new session while one is active
  }

  // Verify the workout day exists
  const day = db.query.workoutDays.findFirst({
    where: eq(workoutDays.id, workoutDayId)
  }).sync();

  if (!day) {
    return null;
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
// excludeLogId: exclude a specific log (used when updating a log)
// forDisplay: when true, excludes the current session (for showing "previous best" to user)
export function getBestPreviousLog(exerciseId: number, excludeSessionId?: number, excludeLogId?: number): { weight: string; reps: number } | null {
  // Get all previous logs for this exercise
  const logs = db.query.exerciseLogs.findMany({
    where: eq(exerciseLogs.exerciseId, exerciseId),
    orderBy: [desc(exerciseLogs.completedAt)]
  }).sync();

  let best: { weight: string; reps: number; score: number } | null = null;

  for (const log of logs) {
    // Skip the specific log if we're updating it
    if (excludeLogId && log.id === excludeLogId) continue;
    // Skip logs from the excluded session (for display purposes)
    if (excludeSessionId && log.sessionId === excludeSessionId) continue;

    const weight = parseWeight(log.weight);
    const reps = log.reps ?? 0;
    const score = weight * reps; // Simple scoring: weight * reps

    if (!best || score > best.score) {
      best = { weight: log.weight ?? '0', reps, score };
    }
  }

  return best ? { weight: best.weight, reps: best.reps } : null;
}

// Check if a new log is a PR compared to ALL previous logs (including current session)
export function isPR(exerciseId: number, weight: string, reps: number, excludeLogId?: number): boolean {
  // Compare against ALL logs (no session exclusion) - only exclude specific log if updating
  const best = getBestPreviousLog(exerciseId, undefined, excludeLogId);
  if (!best) return true; // First log is always a PR

  const newWeight = parseWeight(weight);
  const newScore = newWeight * reps;
  const bestScore = parseWeight(best.weight) * best.reps;

  return newScore > bestScore;
}

// Log an exercise set with weight and reps
export function logExerciseSet(
  sessionId: number,
  exerciseId: number,
  setNumber: number,
  weight: string | null,
  reps: number | null
): ExerciseLogWithPR | null {
  // Verify session exists and is active
  const session = db.query.workoutSessions.findFirst({
    where: and(
      eq(workoutSessions.id, sessionId),
      eq(workoutSessions.status, 'active')
    )
  }).sync();

  if (!session) return null;

  // Verify exercise exists
  const exercise = db.query.exercises.findFirst({
    where: eq(exercises.id, exerciseId)
  }).sync();

  if (!exercise) return null;

  // Check if this is a PR (compare against ALL previous logs including current session)
  const isNewPR = weight && reps ? isPR(exerciseId, weight, reps) : false;
  // Show previous best excluding current session (for display purposes)
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
  logId: number,
  weight: string | null,
  reps: number | null
): ExerciseLogWithPR | null {
  const existing = db.query.exerciseLogs.findFirst({
    where: eq(exerciseLogs.id, logId)
  }).sync();

  if (!existing) return null;

  // Check if this update is a PR (exclude the log being updated from comparison)
  const isNewPR = weight && reps ? isPR(existing.exerciseId, weight, reps, existing.id) : false;
  // Show previous best excluding current session (for display purposes)
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
export function deleteExerciseLog(logId: number): boolean {
  const existing = db.query.exerciseLogs.findFirst({
    where: eq(exerciseLogs.id, logId)
  }).sync();

  if (!existing) return false;

  db.delete(exerciseLogs).where(eq(exerciseLogs.id, logId)).run();
  return true;
}

// Complete the current workout session
export function completeSession(sessionId: number, notes?: string): WorkoutSession | null {
  const session = db.query.workoutSessions.findFirst({
    where: eq(workoutSessions.id, sessionId)
  }).sync();

  if (!session || session.status !== 'active') return null;

  db.update(workoutSessions)
    .set({
      status: 'completed',
      completedAt: new Date().toISOString(),
      notes: notes ?? session.notes
    })
    .where(eq(workoutSessions.id, sessionId))
    .run();

  return getSession(sessionId) as WorkoutSession;
}

// Cancel the current workout session
export function cancelSession(sessionId: number): boolean {
  const session = db.query.workoutSessions.findFirst({
    where: eq(workoutSessions.id, sessionId)
  }).sync();

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
export function getSessionPRs(sessionId: number) {
  return db.query.exerciseLogs.findMany({
    where: and(
      eq(exerciseLogs.sessionId, sessionId),
      eq(exerciseLogs.isPR, true)
    ),
    with: { exercise: true }
  }).sync();
}

// Get exercise history for a specific exercise
export function getExerciseHistory(exerciseId: number, limit = 10) {
  return db.query.exerciseLogs.findMany({
    where: eq(exerciseLogs.exerciseId, exerciseId),
    orderBy: [desc(exerciseLogs.completedAt)],
    limit,
    with: { session: true }
  }).sync();
}

// Get logs for a specific exercise within a session
export function getExerciseLogsInSession(sessionId: number, exerciseId: number) {
  return db.query.exerciseLogs.findMany({
    where: and(
      eq(exerciseLogs.sessionId, sessionId),
      eq(exerciseLogs.exerciseId, exerciseId)
    ),
    orderBy: [exerciseLogs.setNumber]
  }).sync();
}
