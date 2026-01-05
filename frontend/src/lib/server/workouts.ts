import { db } from './db';
import { workoutRoutines, workoutDays, exercises } from './db/schema';
import { eq, asc, and } from 'drizzle-orm';

export function getWorkoutRoutines(activeOnly = true) {
  return db.query.workoutRoutines.findMany({
    where: activeOnly ? eq(workoutRoutines.isActive, true) : undefined,
    with: {
      days: {
        with: { exercises: true },
        orderBy: [asc(workoutDays.sortOrder)]
      }
    }
  }).sync();
}

export function getWorkoutRoutine(id: number) {
  return db.query.workoutRoutines.findFirst({
    where: eq(workoutRoutines.id, id),
    with: {
      days: {
        with: { exercises: true },
        orderBy: [asc(workoutDays.sortOrder)]
      }
    }
  }).sync();
}

export function getTodaysWorkout() {
  // JavaScript: Sunday=0, Monday=1... we need Monday=0
  const jsDay = new Date().getDay();
  const dayOfWeek = jsDay === 0 ? 6 : jsDay - 1;

  const activeRoutine = db.query.workoutRoutines.findFirst({
    where: eq(workoutRoutines.isActive, true)
  }).sync();

  if (!activeRoutine) return null;

  return db.query.workoutDays.findFirst({
    where: and(
      eq(workoutDays.routineId, activeRoutine.id),
      eq(workoutDays.dayOfWeek, dayOfWeek)
    ),
    with: { exercises: true }
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

export function createWorkoutRoutine(data: WorkoutRoutineInput) {
  const result = db.insert(workoutRoutines).values({
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

  return getWorkoutRoutine(routine.id);
}

export function updateWorkoutRoutine(id: number, data: Partial<{
  name: string;
  description: string;
  isActive: boolean;
}>) {
  db.update(workoutRoutines)
    .set({ ...data, updatedAt: new Date().toISOString() })
    .where(eq(workoutRoutines.id, id))
    .run();

  return getWorkoutRoutine(id);
}

export function deleteWorkoutRoutine(id: number) {
  const existing = getWorkoutRoutine(id);
  if (!existing) return false;

  db.delete(workoutRoutines).where(eq(workoutRoutines.id, id)).run();
  return true;
}

// Workout Day operations
export function createWorkoutDay(routineId: number, data: {
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
  const routine = getWorkoutRoutine(routineId);
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

export function updateWorkoutDay(dayId: number, data: Partial<{
  name: string;
  dayOfWeek: number | null;
  sortOrder: number;
}>) {
  db.update(workoutDays).set(data).where(eq(workoutDays.id, dayId)).run();

  return db.query.workoutDays.findFirst({
    where: eq(workoutDays.id, dayId),
    with: { exercises: true }
  }).sync();
}

export function deleteWorkoutDay(dayId: number) {
  const existing = db.query.workoutDays.findFirst({
    where: eq(workoutDays.id, dayId)
  }).sync();
  if (!existing) return false;

  db.delete(workoutDays).where(eq(workoutDays.id, dayId)).run();
  return true;
}

// Exercise operations
export function createExercise(dayId: number, data: {
  name: string;
  targetSets?: number;
  targetReps?: string;
  targetWeight?: string;
  restSeconds?: number;
  notes?: string;
  sortOrder?: number;
}) {
  const day = db.query.workoutDays.findFirst({
    where: eq(workoutDays.id, dayId)
  }).sync();
  if (!day) return null;

  const result = db.insert(exercises).values({
    workoutDayId: dayId,
    ...data,
    sortOrder: data.sortOrder ?? 0
  }).returning().all();

  return result[0];
}

export function updateExercise(exerciseId: number, data: Partial<{
  name: string;
  targetSets: number;
  targetReps: string;
  targetWeight: string;
  restSeconds: number;
  notes: string;
  sortOrder: number;
}>) {
  db.update(exercises).set(data).where(eq(exercises.id, exerciseId)).run();

  return db.query.exercises.findFirst({
    where: eq(exercises.id, exerciseId)
  }).sync();
}

export function deleteExercise(exerciseId: number) {
  const existing = db.query.exercises.findFirst({
    where: eq(exercises.id, exerciseId)
  }).sync();
  if (!existing) return false;

  db.delete(exercises).where(eq(exercises.id, exerciseId)).run();
  return true;
}
