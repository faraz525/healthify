import { writable, derived } from 'svelte/store';
import { api, type WorkoutSession, type ExerciseLog, type ExerciseLogCreate, type PersonalRecord } from '$lib/api';

function createSessionStore() {
  const { subscribe, set, update } = writable<WorkoutSession | null>(null);
  const loading = writable(false);
  const error = writable<string | null>(null);

  return {
    subscribe,
    loading,
    error,

    async loadActive() {
      loading.set(true);
      error.set(null);
      try {
        const session = await api.getActiveSession();
        set(session);
        return session;
      } catch (e) {
        error.set(e instanceof Error ? e.message : 'Failed to load active session');
        return null;
      } finally {
        loading.set(false);
      }
    },

    async start(workoutDayId: number | null, date: string) {
      loading.set(true);
      error.set(null);
      try {
        const session = await api.createSession({
          workout_day_id: workoutDayId,
          date,
        });
        set(session);
        return session;
      } catch (e) {
        error.set(e instanceof Error ? e.message : 'Failed to start workout');
        throw e;
      } finally {
        loading.set(false);
      }
    },

    async complete(notes?: string) {
      const currentSession = await new Promise<WorkoutSession | null>(resolve => {
        subscribe(s => resolve(s))();
      });

      if (!currentSession) {
        throw new Error('No active session');
      }

      loading.set(true);
      error.set(null);
      try {
        const session = await api.completeSession(currentSession.id, notes);
        set(null); // Clear active session
        return session;
      } catch (e) {
        error.set(e instanceof Error ? e.message : 'Failed to complete workout');
        throw e;
      } finally {
        loading.set(false);
      }
    },

    async logExercise(log: ExerciseLogCreate) {
      const currentSession = await new Promise<WorkoutSession | null>(resolve => {
        subscribe(s => resolve(s))();
      });

      if (!currentSession) {
        throw new Error('No active session');
      }

      loading.set(true);
      error.set(null);
      try {
        const exerciseLog = await api.logExercise(currentSession.id, log);
        update(session => {
          if (!session) return null;
          return {
            ...session,
            exercise_logs: [...session.exercise_logs, exerciseLog],
          };
        });
        return exerciseLog;
      } catch (e) {
        error.set(e instanceof Error ? e.message : 'Failed to log exercise');
        throw e;
      } finally {
        loading.set(false);
      }
    },

    async undoExercise(logId: number) {
      const currentSession = await new Promise<WorkoutSession | null>(resolve => {
        subscribe(s => resolve(s))();
      });

      if (!currentSession) {
        throw new Error('No active session');
      }

      loading.set(true);
      error.set(null);
      try {
        await api.deleteExerciseLog(currentSession.id, logId);
        update(session => {
          if (!session) return null;
          return {
            ...session,
            exercise_logs: session.exercise_logs.filter(l => l.id !== logId),
          };
        });
      } catch (e) {
        error.set(e instanceof Error ? e.message : 'Failed to undo exercise');
        throw e;
      } finally {
        loading.set(false);
      }
    },

    async cancel() {
      const currentSession = await new Promise<WorkoutSession | null>(resolve => {
        subscribe(s => resolve(s))();
      });

      if (!currentSession) return;

      loading.set(true);
      error.set(null);
      try {
        await api.deleteSession(currentSession.id);
        set(null);
      } catch (e) {
        error.set(e instanceof Error ? e.message : 'Failed to cancel workout');
        throw e;
      } finally {
        loading.set(false);
      }
    },

    clear() {
      set(null);
      error.set(null);
    },

    isExerciseLogged(exerciseId: number): boolean {
      let session: WorkoutSession | null = null;
      subscribe(s => session = s)();
      if (!session) return false;
      return session.exercise_logs.some(l => l.exercise_id === exerciseId);
    },

    getLogForExercise(exerciseId: number): ExerciseLog | undefined {
      let session: WorkoutSession | null = null;
      subscribe(s => session = s)();
      if (!session) return undefined;
      return session.exercise_logs.find(l => l.exercise_id === exerciseId);
    }
  };
}

export const session = createSessionStore();

// Derived store for logged exercise IDs (for quick lookup)
export const loggedExerciseIds = derived(session, ($session) => {
  if (!$session) return new Set<number>();
  return new Set($session.exercise_logs.map(l => l.exercise_id).filter((id): id is number => id !== null));
});

// Personal Records Store
function createPRsStore() {
  const { subscribe, set, update } = writable<PersonalRecord[]>([]);
  const loading = writable(false);
  const error = writable<string | null>(null);

  return {
    subscribe,
    loading,
    error,

    async load() {
      loading.set(true);
      error.set(null);
      try {
        const prs = await api.getPersonalRecords();
        set(prs);
        return prs;
      } catch (e) {
        error.set(e instanceof Error ? e.message : 'Failed to load PRs');
        return [];
      } finally {
        loading.set(false);
      }
    },

    async create(pr: { exercise_name: string; record_type: string; value: string; achieved_at: string; notes?: string }) {
      loading.set(true);
      error.set(null);
      try {
        const newPR = await api.createPersonalRecord(pr);
        // Replace existing PR for same exercise/type or add new
        update(prs => {
          const filtered = prs.filter(p =>
            !(p.exercise_name === pr.exercise_name && p.record_type === pr.record_type)
          );
          return [...filtered, newPR].sort((a, b) => a.exercise_name.localeCompare(b.exercise_name));
        });
        return newPR;
      } catch (e) {
        error.set(e instanceof Error ? e.message : 'Failed to create PR');
        throw e;
      } finally {
        loading.set(false);
      }
    },

    async delete(prId: number) {
      loading.set(true);
      error.set(null);
      try {
        await api.deletePersonalRecord(prId);
        update(prs => prs.filter(p => p.id !== prId));
      } catch (e) {
        error.set(e instanceof Error ? e.message : 'Failed to delete PR');
        throw e;
      } finally {
        loading.set(false);
      }
    },

    getPRForExercise(exerciseName: string): PersonalRecord | undefined {
      let prs: PersonalRecord[] = [];
      subscribe(p => prs = p)();
      return prs.find(p => p.exercise_name === exerciseName && p.record_type === 'weight');
    }
  };
}

export const personalRecords = createPRsStore();

// Derived store for PRs indexed by exercise name
export const prsByExercise = derived(personalRecords, ($prs) => {
  const map = new Map<string, PersonalRecord>();
  for (const pr of $prs) {
    if (pr.record_type === 'weight') {
      map.set(pr.exercise_name, pr);
    }
  }
  return map;
});
