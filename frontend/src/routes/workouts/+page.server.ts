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

export const load: PageServerLoad = async () => {
  const routines = getWorkoutRoutines();
  const todaysWorkout = getTodaysWorkout();

  return {
    routines,
    todaysWorkout
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
  }
};
