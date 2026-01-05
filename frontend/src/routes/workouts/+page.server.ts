import type { PageServerLoad, Actions } from './$types';
import { fail } from '@sveltejs/kit';
import {
  getWorkoutRoutines,
  getTodaysWorkout,
  createWorkoutRoutine,
  updateWorkoutRoutine,
  deleteWorkoutRoutine,
  createWorkoutDay,
  updateWorkoutDay,
  deleteWorkoutDay,
  createExercise,
  updateExercise,
  deleteExercise
} from '$lib/server/workouts';
import {
  getActiveSession,
  startSession,
  logExerciseSet,
  updateExerciseLog,
  deleteExerciseLog,
  completeSession,
  cancelSession,
  getSessionPRs,
  getExerciseLogsInSession,
  getBestPreviousLog
} from '$lib/server/sessions';

export const load: PageServerLoad = async () => {
  const routines = getWorkoutRoutines();
  const todaysWorkout = getTodaysWorkout();
  const activeSession = getActiveSession();

  // Get exercise logs and PRs for the active session
  let sessionLogs: Record<number, Array<{ setNumber: number; weight: string | null; reps: number | null; isPR: boolean; id: number }>> = {};
  let sessionPRs: Array<{ exerciseId: number; exerciseName: string; weight: string | null; reps: number | null }> = [];
  let exercisePreviousBests: Record<number, { weight: string; reps: number } | null> = {};

  if (activeSession) {
    // Get all logs grouped by exercise
    if (activeSession.exerciseLogs) {
      for (const log of activeSession.exerciseLogs) {
        if (!sessionLogs[log.exerciseId]) {
          sessionLogs[log.exerciseId] = [];
        }
        sessionLogs[log.exerciseId].push({
          id: log.id,
          setNumber: log.setNumber,
          weight: log.weight,
          reps: log.reps,
          isPR: log.isPR ?? false
        });
      }
    }

    // Get PRs
    const prs = getSessionPRs(activeSession.id);
    sessionPRs = prs.map(pr => ({
      exerciseId: pr.exerciseId,
      exerciseName: pr.exercise?.name ?? 'Unknown',
      weight: pr.weight,
      reps: pr.reps
    }));

    // Get previous bests for each exercise in the workout
    if (activeSession.workoutDay?.exercises) {
      for (const exercise of activeSession.workoutDay.exercises) {
        exercisePreviousBests[exercise.id] = getBestPreviousLog(exercise.id, activeSession.id);
      }
    }
  }

  return {
    routines,
    todaysWorkout,
    activeSession,
    sessionLogs,
    sessionPRs,
    exercisePreviousBests
  };
};

export const actions: Actions = {
  createRoutine: async ({ request }) => {
    const formData = await request.formData();
    const name = formData.get('name') as string;
    const description = formData.get('description') as string;

    if (!name) {
      return fail(400, { error: 'Name is required' });
    }

    const routine = createWorkoutRoutine({ name, description });
    return { success: true, routine };
  },

  updateRoutine: async ({ request }) => {
    const formData = await request.formData();
    const id = parseInt(formData.get('id') as string);
    const data = JSON.parse(formData.get('data') as string);

    const routine = updateWorkoutRoutine(id, data);
    if (!routine) {
      return fail(404, { error: 'Routine not found' });
    }

    return { success: true, routine };
  },

  deleteRoutine: async ({ request }) => {
    const formData = await request.formData();
    const id = parseInt(formData.get('id') as string);

    const deleted = deleteWorkoutRoutine(id);
    if (!deleted) {
      return fail(404, { error: 'Routine not found' });
    }

    return { success: true };
  },

  createDay: async ({ request }) => {
    const formData = await request.formData();
    const routineId = parseInt(formData.get('routineId') as string);
    const data = JSON.parse(formData.get('data') as string);

    const day = createWorkoutDay(routineId, data);
    if (!day) {
      return fail(404, { error: 'Routine not found' });
    }

    return { success: true, day };
  },

  updateDay: async ({ request }) => {
    const formData = await request.formData();
    const dayId = parseInt(formData.get('dayId') as string);
    const data = JSON.parse(formData.get('data') as string);

    const day = updateWorkoutDay(dayId, data);
    if (!day) {
      return fail(404, { error: 'Day not found' });
    }

    return { success: true, day };
  },

  deleteDay: async ({ request }) => {
    const formData = await request.formData();
    const dayId = parseInt(formData.get('dayId') as string);

    const deleted = deleteWorkoutDay(dayId);
    if (!deleted) {
      return fail(404, { error: 'Day not found' });
    }

    return { success: true };
  },

  createExercise: async ({ request }) => {
    const formData = await request.formData();
    const dayId = parseInt(formData.get('dayId') as string);
    const data = JSON.parse(formData.get('data') as string);

    const exercise = createExercise(dayId, data);
    if (!exercise) {
      return fail(404, { error: 'Day not found' });
    }

    return { success: true, exercise };
  },

  updateExercise: async ({ request }) => {
    const formData = await request.formData();
    const exerciseId = parseInt(formData.get('exerciseId') as string);
    const data = JSON.parse(formData.get('data') as string);

    const exercise = updateExercise(exerciseId, data);
    if (!exercise) {
      return fail(404, { error: 'Exercise not found' });
    }

    return { success: true, exercise };
  },

  deleteExercise: async ({ request }) => {
    const formData = await request.formData();
    const exerciseId = parseInt(formData.get('exerciseId') as string);

    const deleted = deleteExercise(exerciseId);
    if (!deleted) {
      return fail(404, { error: 'Exercise not found' });
    }

    return { success: true };
  },

  // Session management actions
  startSession: async ({ request }) => {
    const formData = await request.formData();
    const workoutDayId = parseInt(formData.get('workoutDayId') as string);

    if (!workoutDayId) {
      return fail(400, { error: 'Workout day ID is required' });
    }

    const session = startSession(workoutDayId);
    if (!session) {
      return fail(400, { error: 'Could not start session. There may already be an active session.' });
    }

    return { success: true, session };
  },

  logSet: async ({ request }) => {
    const formData = await request.formData();
    const sessionId = parseInt(formData.get('sessionId') as string);
    const exerciseId = parseInt(formData.get('exerciseId') as string);
    const setNumber = parseInt(formData.get('setNumber') as string);
    const weight = formData.get('weight') as string | null;
    const reps = formData.get('reps') ? parseInt(formData.get('reps') as string) : null;

    if (!sessionId || !exerciseId || !setNumber) {
      return fail(400, { error: 'Session ID, exercise ID, and set number are required' });
    }

    const log = logExerciseSet(sessionId, exerciseId, setNumber, weight, reps);
    if (!log) {
      return fail(400, { error: 'Could not log set' });
    }

    return {
      success: true,
      log,
      isPR: log.isNewPR,
      previousBest: log.previousBest
    };
  },

  updateLog: async ({ request }) => {
    const formData = await request.formData();
    const logId = parseInt(formData.get('logId') as string);
    const weight = formData.get('weight') as string | null;
    const reps = formData.get('reps') ? parseInt(formData.get('reps') as string) : null;

    if (!logId) {
      return fail(400, { error: 'Log ID is required' });
    }

    const log = updateExerciseLog(logId, weight, reps);
    if (!log) {
      return fail(404, { error: 'Log not found' });
    }

    return {
      success: true,
      log,
      isPR: log.isNewPR,
      previousBest: log.previousBest
    };
  },

  deleteLog: async ({ request }) => {
    const formData = await request.formData();
    const logId = parseInt(formData.get('logId') as string);

    if (!logId) {
      return fail(400, { error: 'Log ID is required' });
    }

    const deleted = deleteExerciseLog(logId);
    if (!deleted) {
      return fail(404, { error: 'Log not found' });
    }

    return { success: true };
  },

  completeSession: async ({ request }) => {
    const formData = await request.formData();
    const sessionId = parseInt(formData.get('sessionId') as string);
    const notes = formData.get('notes') as string | null;

    if (!sessionId) {
      return fail(400, { error: 'Session ID is required' });
    }

    const session = completeSession(sessionId, notes ?? undefined);
    if (!session) {
      return fail(400, { error: 'Could not complete session' });
    }

    // Get final PRs for the session
    const prs = getSessionPRs(sessionId);

    return { success: true, session, prs };
  },

  cancelSession: async ({ request }) => {
    const formData = await request.formData();
    const sessionId = parseInt(formData.get('sessionId') as string);

    if (!sessionId) {
      return fail(400, { error: 'Session ID is required' });
    }

    const cancelled = cancelSession(sessionId);
    if (!cancelled) {
      return fail(400, { error: 'Could not cancel session' });
    }

    return { success: true };
  }
};
