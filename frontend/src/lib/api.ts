const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

export interface HealthIssue {
  id?: number;
  daily_entry_id?: number;
  issue_type: string;
  severity: number | null;
  notes: string | null;
  time_of_day: string | null;
  created_at?: string;
}

export interface DailyEntry {
  id?: number;
  date: string;
  stress_level: number | null;
  worked_out: boolean;
  workout_notes: string | null;
  notes: string | null;
  health_issues: HealthIssue[];
  device_metrics?: Record<string, unknown> | null;
  created_at?: string;
  updated_at?: string | null;
}

export interface IssueType {
  id: number;
  name: string;
  display_name: string;
  icon: string | null;
  is_active: boolean;
  sort_order: number;
}

export interface Stats {
  total_entries: number;
  workout_days: number;
  avg_stress: number | null;
  common_issues: Array<{ type: string; count: number }>;
  streak_days: number;
}

export interface Exercise {
  id?: number;
  workout_day_id?: number;
  name: string;
  target_sets: number | null;
  target_reps: string | null;
  target_weight: string | null;
  rest_seconds: number | null;
  notes: string | null;
  sort_order: number;
}

export interface WorkoutDay {
  id?: number;
  routine_id?: number;
  name: string;
  day_of_week: number | null;
  sort_order: number;
  exercises: Exercise[];
}

export interface WorkoutRoutine {
  id?: number;
  name: string;
  description: string | null;
  is_active: boolean;
  days: WorkoutDay[];
  created_at?: string;
  updated_at?: string | null;
}

async function fetchApi<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }

  if (response.status === 204) {
    return null as T;
  }

  return response.json();
}

export const api = {
  // Entries
  getEntries: (params?: { start_date?: string; end_date?: string; limit?: number }) => {
    const query = new URLSearchParams();
    if (params?.start_date) query.set('start_date', params.start_date);
    if (params?.end_date) query.set('end_date', params.end_date);
    if (params?.limit) query.set('limit', params.limit.toString());
    const queryStr = query.toString();
    return fetchApi<DailyEntry[]>(`/entries${queryStr ? `?${queryStr}` : ''}`);
  },

  getEntry: (date: string) => fetchApi<DailyEntry>(`/entries/${date}`),

  getToday: () => fetchApi<DailyEntry | null>('/today'),

  createEntry: (entry: Omit<DailyEntry, 'id' | 'created_at' | 'updated_at'>) =>
    fetchApi<DailyEntry>('/entries', {
      method: 'POST',
      body: JSON.stringify(entry),
    }),

  updateEntry: (date: string, entry: Partial<DailyEntry>) =>
    fetchApi<DailyEntry>(`/entries/${date}`, {
      method: 'PUT',
      body: JSON.stringify(entry),
    }),

  deleteEntry: (date: string) =>
    fetchApi<void>(`/entries/${date}`, { method: 'DELETE' }),

  // Issue Types
  getIssueTypes: () => fetchApi<IssueType[]>('/issue-types'),

  createIssueType: (issueType: { name: string; display_name: string; icon?: string }) =>
    fetchApi<IssueType>('/issue-types', {
      method: 'POST',
      body: JSON.stringify(issueType),
    }),

  // Stats
  getStats: (days = 30) => fetchApi<Stats>(`/stats?days=${days}`),

  // Health check
  health: () => fetchApi<{ status: string }>('/health'),

  // Workout Routines
  getWorkoutRoutines: (activeOnly = true) =>
    fetchApi<WorkoutRoutine[]>(`/workouts?active_only=${activeOnly}`),

  getWorkoutRoutine: (id: number) =>
    fetchApi<WorkoutRoutine>(`/workouts/${id}`),

  getTodaysWorkout: () =>
    fetchApi<WorkoutDay | null>('/workouts/today'),

  createWorkoutRoutine: (routine: { name: string; description?: string; days?: Omit<WorkoutDay, 'id' | 'routine_id'>[] }) =>
    fetchApi<WorkoutRoutine>('/workouts', {
      method: 'POST',
      body: JSON.stringify(routine),
    }),

  updateWorkoutRoutine: (id: number, update: { name?: string; description?: string; is_active?: boolean }) =>
    fetchApi<WorkoutRoutine>(`/workouts/${id}`, {
      method: 'PUT',
      body: JSON.stringify(update),
    }),

  deleteWorkoutRoutine: (id: number) =>
    fetchApi<void>(`/workouts/${id}`, { method: 'DELETE' }),

  // Workout Days
  createWorkoutDay: (routineId: number, day: Omit<WorkoutDay, 'id' | 'routine_id'>) =>
    fetchApi<WorkoutDay>(`/workouts/${routineId}/days`, {
      method: 'POST',
      body: JSON.stringify(day),
    }),

  updateWorkoutDay: (dayId: number, update: { name?: string; day_of_week?: number | null; sort_order?: number }) =>
    fetchApi<WorkoutDay>(`/workouts/days/${dayId}`, {
      method: 'PUT',
      body: JSON.stringify(update),
    }),

  deleteWorkoutDay: (dayId: number) =>
    fetchApi<void>(`/workouts/days/${dayId}`, { method: 'DELETE' }),

  // Exercises
  createExercise: (dayId: number, exercise: Omit<Exercise, 'id' | 'workout_day_id'>) =>
    fetchApi<Exercise>(`/workouts/days/${dayId}/exercises`, {
      method: 'POST',
      body: JSON.stringify(exercise),
    }),

  updateExercise: (exerciseId: number, update: Partial<Omit<Exercise, 'id' | 'workout_day_id'>>) =>
    fetchApi<Exercise>(`/workouts/exercises/${exerciseId}`, {
      method: 'PUT',
      body: JSON.stringify(update),
    }),

  deleteExercise: (exerciseId: number) =>
    fetchApi<void>(`/workouts/exercises/${exerciseId}`, { method: 'DELETE' }),
};
