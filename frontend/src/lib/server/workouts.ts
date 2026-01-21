import { db, sqlite } from './db';
import { workoutRoutines, workoutDays, exercises } from './db/schema';
import { eq, asc, and, or, isNull } from 'drizzle-orm';

// ============================================
// Direct Workout Functions (No Routine Required)
// ============================================

export function getWorkouts(userId: string) {
  try {
    const userRoutine = db.query.workoutRoutines.findFirst({
      where: eq(workoutRoutines.userId, userId)
    }).sync();

    return db.query.workoutDays.findMany({
      where: or(
        eq(workoutDays.userId, userId),
        // Also include workouts from user's routines
        and(
          isNull(workoutDays.userId),
          eq(workoutDays.routineId, userRoutine?.id ?? -1)
        )
      ),
      with: { exercises: true },
      orderBy: [asc(workoutDays.sortOrder)]
    }).sync();
  } catch (err) {
    console.error('Failed to get workouts:', err);
    return [];
  }
}

export function getWorkout(userId: string, id: number) {
  try {
    const workout = db.query.workoutDays.findFirst({
      where: eq(workoutDays.id, id),
      with: { exercises: true, routine: true }
    }).sync();

    // Verify ownership - workout belongs to user directly or through their routine
    if (!workout) return null;
    if (workout.userId === userId) return workout;
    if (workout.routine && workout.routine.userId === userId) return workout;

    return null;
  } catch (err) {
    console.error('Failed to get workout:', err);
    return null;
  }
}

export function getTodaysWorkout(userId: string) {
  try {
    // JavaScript: Sunday=0, Monday=1... we need Monday=0
    const jsDay = new Date().getDay();
    const dayOfWeek = jsDay === 0 ? 6 : jsDay - 1;

    // Find user's workout assigned to today
    const workouts = getWorkouts(userId);
    return workouts.find(w => w.dayOfWeek === dayOfWeek) || null;
  } catch (err) {
    console.error('Failed to get today\'s workout:', err);
    return null;
  }
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

// Uses a transaction to ensure atomic creation of workout and exercises
export function createWorkout(userId: string, data: WorkoutInput) {
  try {
    const createWorkoutTx = sqlite.transaction(() => {
      const result = db.insert(workoutDays).values({
        userId,
        name: data.name,
        dayOfWeek: data.dayOfWeek,
        sortOrder: data.sortOrder ?? 0
      }).returning().all();

      const workout = result[0];
      if (!workout) {
        console.error('Failed to create workout: No result returned');
        return null;
      }

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

      return workout.id;
    });

    const workoutId = createWorkoutTx();
    if (!workoutId) return null;
    return getWorkout(userId, workoutId);
  } catch (err) {
    console.error('Failed to create workout:', err);
    return null;
  }
}

export function updateWorkout(userId: string, id: number, data: Partial<{
  name: string;
  dayOfWeek: number | null;
  sortOrder: number;
}>) {
  try {
    const existing = getWorkout(userId, id);
    if (!existing) return null;

    db.update(workoutDays).set(data).where(eq(workoutDays.id, id)).run();
    return getWorkout(userId, id);
  } catch (err) {
    console.error('Failed to update workout:', err);
    return null;
  }
}

export function deleteWorkout(userId: string, id: number) {
  try {
    const existing = getWorkout(userId, id);
    if (!existing) return false;
    db.delete(workoutDays).where(eq(workoutDays.id, id)).run();
    return true;
  } catch (err) {
    console.error('Failed to delete workout:', err);
    return false;
  }
}

// ============================================
// Legacy Routine Functions (Kept for compatibility)
// ============================================

export function getWorkoutRoutines(userId: string, activeOnly = true) {
  try {
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
  } catch (err) {
    console.error('Failed to get workout routines:', err);
    return [];
  }
}

export function getWorkoutRoutine(userId: string, id: number) {
  try {
    return db.query.workoutRoutines.findFirst({
      where: and(eq(workoutRoutines.id, id), eq(workoutRoutines.userId, userId)),
      with: {
        days: {
          with: { exercises: true },
          orderBy: [asc(workoutDays.sortOrder)]
        }
      }
    }).sync();
  } catch (err) {
    console.error('Failed to get workout routine:', err);
    return undefined;
  }
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

// Uses a transaction to ensure atomic creation of routine, days, and exercises
export function createWorkoutRoutine(userId: string, data: WorkoutRoutineInput) {
  try {
    const createRoutineTx = sqlite.transaction(() => {
      const result = db.insert(workoutRoutines).values({
        userId,
        name: data.name,
        description: data.description,
        isActive: true
      }).returning().all();

      const routine = result[0];
      if (!routine) {
        console.error('Failed to create workout routine: No result returned');
        return null;
      }

      if (data.days && data.days.length > 0) {
        for (const dayData of data.days) {
          const dayResult = db.insert(workoutDays).values({
            routineId: routine.id,
            name: dayData.name,
            dayOfWeek: dayData.dayOfWeek,
            sortOrder: dayData.sortOrder ?? 0
          }).returning().all();

          const day = dayResult[0];
          if (!day) {
            console.error('Failed to create workout day: No result returned');
            continue;
          }

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

      return routine.id;
    });

    const routineId = createRoutineTx();
    if (!routineId) return null;
    return getWorkoutRoutine(userId, routineId);
  } catch (err) {
    console.error('Failed to create workout routine:', err);
    return null;
  }
}

export function updateWorkoutRoutine(userId: string, id: number, data: Partial<{
  name: string;
  description: string;
  isActive: boolean;
}>) {
  try {
    const existing = getWorkoutRoutine(userId, id);
    if (!existing) return null;

    db.update(workoutRoutines)
      .set({ ...data, updatedAt: new Date().toISOString() })
      .where(eq(workoutRoutines.id, id))
      .run();

    return getWorkoutRoutine(userId, id);
  } catch (err) {
    console.error('Failed to update workout routine:', err);
    return null;
  }
}

export function deleteWorkoutRoutine(userId: string, id: number) {
  try {
    const existing = getWorkoutRoutine(userId, id);
    if (!existing) return false;

    db.delete(workoutRoutines).where(eq(workoutRoutines.id, id)).run();
    return true;
  } catch (err) {
    console.error('Failed to delete workout routine:', err);
    return false;
  }
}

// Workout Day operations
// Uses a transaction to ensure atomic creation of workout day and exercises
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
  try {
    const routine = getWorkoutRoutine(userId, routineId);
    if (!routine) return null;

    const createDayTx = sqlite.transaction(() => {
      const dayResult = db.insert(workoutDays).values({
        routineId,
        name: data.name,
        dayOfWeek: data.dayOfWeek,
        sortOrder: data.sortOrder ?? 0
      }).returning().all();

      const day = dayResult[0];
      if (!day) {
        console.error('Failed to create workout day: No result returned');
        return null;
      }

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

      return day.id;
    });

    const dayId = createDayTx();
    if (!dayId) return null;
    return db.query.workoutDays.findFirst({
      where: eq(workoutDays.id, dayId),
      with: { exercises: true }
    }).sync();
  } catch (err) {
    console.error('Failed to create workout day:', err);
    return null;
  }
}

export function updateWorkoutDay(userId: string, dayId: number, data: Partial<{
  name: string;
  dayOfWeek: number | null;
  sortOrder: number;
}>) {
  try {
    // Verify ownership
    const workout = getWorkout(userId, dayId);
    if (!workout) return null;

    db.update(workoutDays).set(data).where(eq(workoutDays.id, dayId)).run();

    return db.query.workoutDays.findFirst({
      where: eq(workoutDays.id, dayId),
      with: { exercises: true }
    }).sync();
  } catch (err) {
    console.error('Failed to update workout day:', err);
    return null;
  }
}

export function deleteWorkoutDay(userId: string, dayId: number) {
  try {
    const workout = getWorkout(userId, dayId);
    if (!workout) return false;

    db.delete(workoutDays).where(eq(workoutDays.id, dayId)).run();
    return true;
  } catch (err) {
    console.error('Failed to delete workout day:', err);
    return false;
  }
}

// Exercise operations

// Generate a new unique link group ID scoped to a user
// SECURITY: Link groups are now scoped per-user to prevent cross-user collisions
export function generateLinkGroupId(userId: string): number {
  try {
    // Get max linkGroupId only from exercises belonging to this user's workouts
    const userWorkouts = getWorkouts(userId);
    const userWorkoutIds = userWorkouts.map(w => w.id);

    if (userWorkoutIds.length === 0) return 1;

    const userExercises = db.query.exercises.findMany({
      where: or(...userWorkoutIds.map(id => eq(exercises.workoutDayId, id)))
    }).sync();

    const maxId = userExercises.reduce((max, ex) => Math.max(max, ex.linkGroupId ?? 0), 0);
    return maxId + 1;
  } catch (err) {
    console.error('Failed to generate link group ID:', err);
    // Fallback: use timestamp + random to minimize collision risk
    return Date.now() % 1000000000 + Math.floor(Math.random() * 1000);
  }
}

// Get all exercises in a link group
export function getLinkedExercises(linkGroupId: number) {
  try {
    return db.query.exercises.findMany({
      where: eq(exercises.linkGroupId, linkGroupId),
      with: { workoutDay: true }
    }).sync();
  } catch (err) {
    console.error('Failed to get linked exercises:', err);
    return [];
  }
}

export function createExercise(userId: string, dayId: number, data: {
  name: string;
  targetSets?: number;
  targetReps?: string;
  targetWeight?: string;
  restSeconds?: number;
  notes?: string;
  sortOrder?: number;
  linkGroupId?: number;
}) {
  try {
    const workout = getWorkout(userId, dayId);
    if (!workout) return null;

    const result = db.insert(exercises).values({
      workoutDayId: dayId,
      ...data,
      sortOrder: data.sortOrder ?? 0,
      linkGroupId: data.linkGroupId ?? null
    }).returning().all();

    return result[0] ?? null;
  } catch (err) {
    console.error('Failed to create exercise:', err);
    return null;
  }
}

// Create a linked copy of an existing exercise
// Uses a transaction to prevent race conditions in linkGroupId generation
export function createLinkedExercise(userId: string, sourceExerciseId: number, targetDayId: number) {
  try {
    // Get source exercise
    const source = db.query.exercises.findFirst({
      where: eq(exercises.id, sourceExerciseId),
      with: { workoutDay: true }
    }).sync();

    if (!source) return null;

    // Verify user owns the source workout
    const sourceWorkout = getWorkout(userId, source.workoutDayId);
    if (!sourceWorkout) return null;

    // Verify user owns the target workout
    const targetWorkout = getWorkout(userId, targetDayId);
    if (!targetWorkout) return null;

    // Use a transaction to atomically generate linkGroupId and create the linked exercise
    const createLinkedTx = sqlite.transaction(() => {
      // Determine the link group ID
      let linkGroupId = source.linkGroupId;
      if (!linkGroupId) {
        // Source is not linked yet - create a new link group and update source
        // Pass userId to scope the linkGroupId to this user
        linkGroupId = generateLinkGroupId(userId);
        db.update(exercises)
          .set({ linkGroupId })
          .where(eq(exercises.id, sourceExerciseId))
          .run();
      }

      // Create the linked copy
      const result = db.insert(exercises).values({
        workoutDayId: targetDayId,
        name: source.name,
        targetSets: source.targetSets,
        targetReps: source.targetReps,
        targetWeight: source.targetWeight,
        restSeconds: source.restSeconds,
        notes: source.notes,
        sortOrder: 0,
        linkGroupId
      }).returning().all();

      return result[0] ?? null;
    });

    return createLinkedTx();
  } catch (err) {
    console.error('Failed to create linked exercise:', err);
    return null;
  }
}

// Unlink an exercise from its group
export function unlinkExercise(userId: string, exerciseId: number) {
  try {
    const exercise = db.query.exercises.findFirst({
      where: eq(exercises.id, exerciseId)
    }).sync();

    if (!exercise) return false;

    const workout = getWorkout(userId, exercise.workoutDayId);
    if (!workout) return false;

    db.update(exercises)
      .set({ linkGroupId: null })
      .where(eq(exercises.id, exerciseId))
      .run();

    return true;
  } catch (err) {
    console.error('Failed to unlink exercise:', err);
    return false;
  }
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
  try {
    // Get exercise and verify ownership through workout
    const exercise = db.query.exercises.findFirst({
      where: eq(exercises.id, exerciseId),
      with: { workoutDay: true }
    }).sync();

    if (!exercise) return null;

    const workout = getWorkout(userId, exercise.workoutDayId);
    if (!workout) return null;

    // Update the exercise
    db.update(exercises).set(data).where(eq(exercises.id, exerciseId)).run();

    // If this exercise is linked and weight was updated, sync to other linked exercises
    // SECURITY: Only syncs to exercises the user owns (linkGroupId is scoped per-user)
    if (exercise.linkGroupId && data.targetWeight !== undefined) {
      const linkedExercises = getLinkedExercises(exercise.linkGroupId);
      for (const linked of linkedExercises) {
        if (linked.id !== exerciseId) {
          // Verify user owns the linked exercise's workout before updating
          const linkedWorkout = getWorkout(userId, linked.workoutDayId);
          if (linkedWorkout) {
            db.update(exercises)
              .set({ targetWeight: data.targetWeight })
              .where(eq(exercises.id, linked.id))
              .run();
          }
        }
      }
    }

    return db.query.exercises.findFirst({
      where: eq(exercises.id, exerciseId)
    }).sync();
  } catch (err) {
    console.error('Failed to update exercise:', err);
    return null;
  }
}

export function deleteExercise(userId: string, exerciseId: number) {
  try {
    const exercise = db.query.exercises.findFirst({
      where: eq(exercises.id, exerciseId)
    }).sync();

    if (!exercise) return false;

    const workout = getWorkout(userId, exercise.workoutDayId);
    if (!workout) return false;

    db.delete(exercises).where(eq(exercises.id, exerciseId)).run();
    return true;
  } catch (err) {
    console.error('Failed to delete exercise:', err);
    return false;
  }
}

export function reorderExercise(userId: string, exerciseId: number, direction: 'up' | 'down') {
  try {
    // Get the exercise and verify ownership
    const exercise = db.query.exercises.findFirst({
      where: eq(exercises.id, exerciseId),
      with: { workoutDay: true }
    }).sync();

    if (!exercise) return false;

    const workout = getWorkout(userId, exercise.workoutDayId);
    if (!workout) return false;

    // Get all exercises in the workout sorted by sortOrder
    const allExercises = db.query.exercises.findMany({
      where: eq(exercises.workoutDayId, exercise.workoutDayId),
      orderBy: [asc(exercises.sortOrder)]
    }).sync();

    // Find the current exercise index
    const currentIndex = allExercises.findIndex(e => e.id === exerciseId);
    if (currentIndex === -1) return false;

    // Determine the swap target index
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;

    // Check bounds
    if (targetIndex < 0 || targetIndex >= allExercises.length) return false;

    const currentExercise = allExercises[currentIndex];
    const targetExercise = allExercises[targetIndex];

    // Swap sortOrder values using a transaction
    const swapTx = sqlite.transaction(() => {
      const tempOrder = currentExercise.sortOrder;
      db.update(exercises)
        .set({ sortOrder: targetExercise.sortOrder })
        .where(eq(exercises.id, currentExercise.id))
        .run();
      db.update(exercises)
        .set({ sortOrder: tempOrder })
        .where(eq(exercises.id, targetExercise.id))
        .run();
    });

    swapTx();
    return true;
  } catch (err) {
    console.error('Failed to reorder exercise:', err);
    return false;
  }
}
