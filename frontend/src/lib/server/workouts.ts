import { db } from './db';
import { workoutRoutines, workoutDays, exercises } from './db/schema';
import { eq, asc, and, or, isNull } from 'drizzle-orm';

// ============================================
// Direct Workout Functions (No Routine Required)
// ============================================

export function getWorkouts(userId: string) {
  return db.query.workoutDays.findMany({
    where: or(
      eq(workoutDays.userId, userId),
      // Also include workouts from user's routines
      and(
        isNull(workoutDays.userId),
        eq(workoutDays.routineId, db.query.workoutRoutines.findFirst({
          where: eq(workoutRoutines.userId, userId)
        }).sync()?.id ?? -1)
      )
    ),
    with: { exercises: true },
    orderBy: [asc(workoutDays.sortOrder)]
  }).sync();
}

export function getWorkout(userId: string, id: number) {
  const workout = db.query.workoutDays.findFirst({
    where: eq(workoutDays.id, id),
    with: { exercises: true, routine: true }
  }).sync();

  // Verify ownership - workout belongs to user directly or through their routine
  if (!workout) return null;
  if (workout.userId === userId) return workout;
  if (workout.routine && workout.routine.userId === userId) return workout;

  return null;
}

export function getTodaysWorkout(userId: string) {
  // JavaScript: Sunday=0, Monday=1... we need Monday=0
  const jsDay = new Date().getDay();
  const dayOfWeek = jsDay === 0 ? 6 : jsDay - 1;

  // Find user's workout assigned to today
  const workouts = getWorkouts(userId);
  return workouts.find(w => w.dayOfWeek === dayOfWeek) || null;
}

export type WorkoutInput = {
  name: string;
  dayOfWeek?: number | null;
  sortOrder?: number;
  exercises?: Array<{
    name: string;
    targetSets?: number;
    targetReps?: string;
    targetWeight?: string;
    restSeconds?: number;
    notes?: string;
    sortOrder?: number;
  }>;
};

export function createWorkout(userId: string, data: WorkoutInput) {
  const result = db.insert(workoutDays).values({
    userId,
    name: data.name,
    dayOfWeek: data.dayOfWeek,
    sortOrder: data.sortOrder ?? 0
  }).returning().all();

  const workout = result[0];

  if (data.exercises && data.exercises.length > 0) {
    db.insert(exercises).values(
      data.exercises.map(ex => ({
        workoutDayId: workout.id,
        name: ex.name,
        targetSets: ex.targetSets,
        targetReps: ex.targetReps,
        targetWeight: ex.targetWeight,
        restSeconds: ex.restSeconds,
        notes: ex.notes,
        sortOrder: ex.sortOrder ?? 0
      }))
    ).run();
  }

  return getWorkout(userId, workout.id);
}

export function updateWorkout(userId: string, id: number, data: Partial<{
  name: string;
  dayOfWeek: number | null;
  sortOrder: number;
}>) {
  const existing = getWorkout(userId, id);
  if (!existing) return null;

  db.update(workoutDays).set(data).where(eq(workoutDays.id, id)).run();
  return getWorkout(userId, id);
}

export function deleteWorkout(userId: string, id: number) {
  const existing = getWorkout(userId, id);
  if (!existing) return false;
  db.delete(workoutDays).where(eq(workoutDays.id, id)).run();
  return true;
}

// ============================================
// Legacy Routine Functions (Kept for compatibility)
// ============================================

export function getWorkoutRoutines(userId: string, activeOnly = true) {
  const conditions = [eq(workoutRoutines.userId, userId)];
  if (activeOnly) conditions.push(eq(workoutRoutines.isActive, true));

  return db.query.workoutRoutines.findMany({
    where: and(...conditions),
    with: {
      days: {
        with: { exercises: true },
        orderBy: [asc(workoutDays.sortOrder)]
      }
    }
  }).sync();
}

export function getWorkoutRoutine(userId: string, id: number) {
  return db.query.workoutRoutines.findFirst({
    where: and(eq(workoutRoutines.id, id), eq(workoutRoutines.userId, userId)),
    with: {
      days: {
        with: { exercises: true },
        orderBy: [asc(workoutDays.sortOrder)]
      }
    }
  }).sync();
}

export type WorkoutRoutineInput = {
  name: string;
  description?: string;
  days?: Array<{
    name: string;
    dayOfWeek?: number | null;
    sortOrder?: number;
    exercises?: Array<{
      name: string;
      targetSets?: number;
      targetReps?: string;
      targetWeight?: string;
      restSeconds?: number;
      notes?: string;
      sortOrder?: number;
    }>;
  }>;
};

export function createWorkoutRoutine(userId: string, data: WorkoutRoutineInput) {
  const result = db.insert(workoutRoutines).values({
    userId,
    name: data.name,
    description: data.description,
    isActive: true
  }).returning().all();

  const routine = result[0];

  if (data.days && data.days.length > 0) {
    for (const dayData of data.days) {
      const dayResult = db.insert(workoutDays).values({
        routineId: routine.id,
        name: dayData.name,
        dayOfWeek: dayData.dayOfWeek,
        sortOrder: dayData.sortOrder ?? 0
      }).returning().all();

      const day = dayResult[0];

      if (dayData.exercises && dayData.exercises.length > 0) {
        db.insert(exercises).values(
          dayData.exercises.map(ex => ({
            workoutDayId: day.id,
            name: ex.name,
            targetSets: ex.targetSets,
            targetReps: ex.targetReps,
            targetWeight: ex.targetWeight,
            restSeconds: ex.restSeconds,
            notes: ex.notes,
            sortOrder: ex.sortOrder ?? 0
          }))
        ).run();
      }
    }
  }

  return getWorkoutRoutine(userId, routine.id);
}

export function updateWorkoutRoutine(userId: string, id: number, data: Partial<{
  name: string;
  description: string;
  isActive: boolean;
}>) {
  const existing = getWorkoutRoutine(userId, id);
  if (!existing) return null;

  db.update(workoutRoutines)
    .set({ ...data, updatedAt: new Date().toISOString() })
    .where(eq(workoutRoutines.id, id))
    .run();

  return getWorkoutRoutine(userId, id);
}

export function deleteWorkoutRoutine(userId: string, id: number) {
  const existing = getWorkoutRoutine(userId, id);
  if (!existing) return false;

  db.delete(workoutRoutines).where(eq(workoutRoutines.id, id)).run();
  return true;
}

// Workout Day operations
export function createWorkoutDay(userId: string, routineId: number, data: {
  name: string;
  dayOfWeek?: number | null;
  sortOrder?: number;
  exercises?: Array<{
    name: string;
    targetSets?: number;
    targetReps?: string;
    targetWeight?: string;
    restSeconds?: number;
    notes?: string;
    sortOrder?: number;
  }>;
}) {
  const routine = getWorkoutRoutine(userId, routineId);
  if (!routine) return null;

  const dayResult = db.insert(workoutDays).values({
    routineId,
    name: data.name,
    dayOfWeek: data.dayOfWeek,
    sortOrder: data.sortOrder ?? 0
  }).returning().all();

  const day = dayResult[0];

  if (data.exercises && data.exercises.length > 0) {
    db.insert(exercises).values(
      data.exercises.map(ex => ({
        workoutDayId: day.id,
        name: ex.name,
        targetSets: ex.targetSets,
        targetReps: ex.targetReps,
        targetWeight: ex.targetWeight,
        restSeconds: ex.restSeconds,
        notes: ex.notes,
        sortOrder: ex.sortOrder ?? 0
      }))
    ).run();
  }

  return db.query.workoutDays.findFirst({
    where: eq(workoutDays.id, day.id),
    with: { exercises: true }
  }).sync();
}

export function updateWorkoutDay(userId: string, dayId: number, data: Partial<{
  name: string;
  dayOfWeek: number | null;
  sortOrder: number;
}>) {
  // Verify ownership
  const workout = getWorkout(userId, dayId);
  if (!workout) return null;

  db.update(workoutDays).set(data).where(eq(workoutDays.id, dayId)).run();

  return db.query.workoutDays.findFirst({
    where: eq(workoutDays.id, dayId),
    with: { exercises: true }
  }).sync();
}

export function deleteWorkoutDay(userId: string, dayId: number) {
  const workout = getWorkout(userId, dayId);
  if (!workout) return false;

  db.delete(workoutDays).where(eq(workoutDays.id, dayId)).run();
  return true;
}

// Exercise operations
export function createExercise(userId: string, dayId: number, data: {
  name: string;
  targetSets?: number;
  targetReps?: string;
  targetWeight?: string;
  restSeconds?: number;
  notes?: string;
  sortOrder?: number;
}) {
  const workout = getWorkout(userId, dayId);
  if (!workout) return null;

  const result = db.insert(exercises).values({
    workoutDayId: dayId,
    ...data,
    sortOrder: data.sortOrder ?? 0
  }).returning().all();

  return result[0];
}

export function updateExercise(userId: string, exerciseId: number, data: Partial<{
  name: string;
  targetSets: number;
  targetReps: string;
  targetWeight: string;
  restSeconds: number;
  notes: string;
  sortOrder: number;
}>) {
  // Get exercise and verify ownership through workout
  const exercise = db.query.exercises.findFirst({
    where: eq(exercises.id, exerciseId),
    with: { workoutDay: true }
  }).sync();

  if (!exercise) return null;

  const workout = getWorkout(userId, exercise.workoutDayId);
  if (!workout) return null;

  db.update(exercises).set(data).where(eq(exercises.id, exerciseId)).run();

  return db.query.exercises.findFirst({
    where: eq(exercises.id, exerciseId)
  }).sync();
}

export function deleteExercise(userId: string, exerciseId: number) {
  const exercise = db.query.exercises.findFirst({
    where: eq(exercises.id, exerciseId)
  }).sync();

  if (!exercise) return false;

  const workout = getWorkout(userId, exercise.workoutDayId);
  if (!workout) return false;

  db.delete(exercises).where(eq(exercises.id, exerciseId)).run();
  return true;
}
