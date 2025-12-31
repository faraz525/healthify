import { browser } from '$app/environment';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

// Token management
let accessToken: string | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

// Auth types
export interface User {
  id: string;
  email: string;
  role: 'admin' | 'user';
  created_at: string;
}

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  user: User;
}

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
  workout_type: string | null;
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

// Workout Session types
export interface ExerciseLog {
  id: number;
  session_id: number;
  exercise_id: number | null;
  exercise_name: string;
  sets_completed: number;
  reps_achieved: string | null;
  weight_used: string | null;
  is_pr: boolean;
  notes: string | null;
  completed_at: string;
}

export interface ExerciseLogCreate {
  exercise_id?: number | null;
  exercise_name: string;
  sets_completed: number;
  reps_achieved?: string | null;
  weight_used?: string | null;
  notes?: string | null;
}

export interface WorkoutSession {
  id: number;
  workout_day_id: number | null;
  date: string;
  notes: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  exercise_logs: ExerciseLog[];
  workout_day_name: string | null;
}

export interface WorkoutSessionSummary {
  id: number;
  workout_day_id: number | null;
  date: string;
  notes: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  workout_day_name: string | null;
  exercises_completed: number;
}

export interface PersonalRecord {
  id: number;
  exercise_name: string;
  record_type: 'weight' | 'reps' | 'volume';
  value: string;
  achieved_at: string;
  exercise_log_id: number | null;
  notes: string | null;
  created_at: string;
}

export interface ExerciseProgressionPoint {
  date: string;
  weight: string | null;
  sets: number;
  reps: string | null;
  is_pr: boolean;
}

export interface ExerciseProgression {
  exercise_name: string;
  history: ExerciseProgressionPoint[];
  current_pr: PersonalRecord | null;
}

// Flag to prevent multiple refresh attempts
let isRefreshing = false;

async function tryRefreshToken(): Promise<boolean> {
  if (isRefreshing) return false;
  isRefreshing = true;

  try {
    const response = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    });

    if (response.ok) {
      const data: AuthResponse = await response.json();
      accessToken = data.access_token;
      if (browser) {
        localStorage.setItem('accessToken', data.access_token);
      }
      isRefreshing = false;
      return true;
    }
  } catch {
    // Refresh failed
  }

  isRefreshing = false;
  return false;
}

async function fetchApi<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
    credentials: 'include',
  });

  // Handle 401 - try refresh (but not for auth endpoints)
  if (response.status === 401 && !endpoint.startsWith('/auth/')) {
    const refreshed = await tryRefreshToken();
    if (refreshed) {
      // Retry with new token
      headers['Authorization'] = `Bearer ${accessToken}`;
      const retryResponse = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers,
        credentials: 'include',
      });

      if (retryResponse.ok) {
        if (retryResponse.status === 204) {
          return null as T;
        }
        return retryResponse.json();
      }
    }

    // Refresh failed, redirect to login
    if (browser) {
      localStorage.removeItem('accessToken');
      window.location.href = '/login';
    }
    throw new Error('Session expired');
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    const message = typeof error.detail === 'string'
      ? error.detail
      : error.detail?.message || `HTTP ${response.status}`;
    throw new Error(message);
  }

  if (response.status === 204) {
    return null as T;
  }

  return response.json();
}

// Auth API
export const authApi = {
  signup: (email: string, password: string) =>
    fetchApi<AuthResponse>('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  login: (email: string, password: string) =>
    fetchApi<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  logout: () =>
    fetchApi<{ message: string }>('/auth/logout', { method: 'POST' }),

  refresh: () =>
    fetchApi<AuthResponse>('/auth/refresh', { method: 'POST' }),

  getMe: () => fetchApi<User>('/auth/me'),
};

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

  // Workout Sessions
  getSessions: (params?: { start_date?: string; end_date?: string; limit?: number }) => {
    const query = new URLSearchParams();
    if (params?.start_date) query.set('start_date', params.start_date);
    if (params?.end_date) query.set('end_date', params.end_date);
    if (params?.limit) query.set('limit', params.limit.toString());
    const queryStr = query.toString();
    return fetchApi<WorkoutSessionSummary[]>(`/sessions${queryStr ? `?${queryStr}` : ''}`);
  },

  getSession: (sessionId: number) =>
    fetchApi<WorkoutSession>(`/sessions/${sessionId}`),

  getActiveSession: () =>
    fetchApi<WorkoutSession | null>('/sessions/active'),

  createSession: (session: { workout_day_id?: number | null; date: string; notes?: string }) =>
    fetchApi<WorkoutSession>('/sessions', {
      method: 'POST',
      body: JSON.stringify(session),
    }),

  updateSession: (sessionId: number, update: { notes?: string }) =>
    fetchApi<WorkoutSession>(`/sessions/${sessionId}`, {
      method: 'PUT',
      body: JSON.stringify(update),
    }),

  completeSession: (sessionId: number, notes?: string) =>
    fetchApi<WorkoutSession>(`/sessions/${sessionId}/complete${notes ? `?notes=${encodeURIComponent(notes)}` : ''}`, {
      method: 'POST',
    }),

  deleteSession: (sessionId: number) =>
    fetchApi<void>(`/sessions/${sessionId}`, { method: 'DELETE' }),

  // Exercise Logging
  logExercise: (sessionId: number, log: ExerciseLogCreate) =>
    fetchApi<ExerciseLog>(`/sessions/${sessionId}/log`, {
      method: 'POST',
      body: JSON.stringify(log),
    }),

  updateExerciseLog: (sessionId: number, logId: number, update: Partial<ExerciseLogCreate>) =>
    fetchApi<ExerciseLog>(`/sessions/${sessionId}/log/${logId}`, {
      method: 'PUT',
      body: JSON.stringify(update),
    }),

  deleteExerciseLog: (sessionId: number, logId: number) =>
    fetchApi<void>(`/sessions/${sessionId}/log/${logId}`, { method: 'DELETE' }),

  // Personal Records
  getPersonalRecords: () =>
    fetchApi<PersonalRecord[]>('/prs'),

  createPersonalRecord: (pr: { exercise_name: string; record_type: string; value: string; achieved_at: string; notes?: string }) =>
    fetchApi<PersonalRecord>('/prs', {
      method: 'POST',
      body: JSON.stringify(pr),
    }),

  deletePersonalRecord: (prId: number) =>
    fetchApi<void>(`/prs/${prId}`, { method: 'DELETE' }),

  // Exercise Progression
  getLoggedExercises: () =>
    fetchApi<string[]>('/exercises/logged'),

  getExerciseHistory: (exerciseName: string, limit = 50) =>
    fetchApi<ExerciseProgression>(`/exercises/${encodeURIComponent(exerciseName)}/history?limit=${limit}`),
};
