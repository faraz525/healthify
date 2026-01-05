// Stub API file - types only, actual data comes from SvelteKit server routes

export interface DailyEntry {
  id: number;
  date: string;
  stressLevel: number | null;
  workedOut: boolean | null;
  workoutNotes: string | null;
  notes: string | null;
  healthIssues: HealthIssue[];
}

export interface HealthIssue {
  id: number;
  issueType: string;
  severity: number | null;
  notes: string | null;
  timeOfDay: string | null;
}

export interface IssueType {
  id: number;
  name: string;
  displayName: string;
  icon: string | null;
  isActive: boolean | null;
  sortOrder: number | null;
}

export interface WorkoutRoutine {
  id: number;
  name: string;
  description: string | null;
  isActive: boolean | null;
  days: WorkoutDay[];
}

export interface WorkoutDay {
  id: number;
  name: string;
  dayOfWeek: number | null;
  sortOrder: number;
  exercises: Exercise[];
}

export interface Exercise {
  id: number;
  name: string;
  targetSets: number | null;
  targetReps: string | null;
  targetWeight: string | null;
  restSeconds: number | null;
  notes: string | null;
  sortOrder: number;
}

export interface Stats {
  total_entries: number;
  days_worked_out: number;
  avg_stress_level: number | null;
  common_issues: Array<{ issue_type: string; count: number }>;
  workout_streak: number;
}

// Stub API object - not used, data comes from server routes
export const api = {
  getEntries: async () => [] as DailyEntry[],
  createEntry: async () => ({} as DailyEntry),
  updateEntry: async () => ({} as DailyEntry),
  deleteEntry: async () => {},
  getStats: async () => ({} as Stats),
  getIssueTypes: async () => [] as IssueType[],
};
