import { sqliteTable, text, integer, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { relations } from 'drizzle-orm';

// Users table
export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: text('role').default('user'),
  createdAt: text('created_at').default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at')
});

// Sessions table for cookie-based auth
export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: text('expires_at').notNull(),
  createdAt: text('created_at').default('CURRENT_TIMESTAMP')
});

// Refresh Tokens table for token-based auth
export const refreshTokens = sqliteTable('refresh_tokens', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  tokenHash: text('token_hash').notNull(),
  expiresAt: text('expires_at').notNull(),
  revokedAt: text('revoked_at'),
  createdAt: text('created_at').default('CURRENT_TIMESTAMP')
});

// Daily Entries table
export const dailyEntries = sqliteTable('daily_entries', {
  userId: text('user_id').notNull().references(() => users.id),
  id: integer('id').primaryKey({ autoIncrement: true }),
  date: text('date').notNull(),
  stressLevel: integer('stress_level'),
  workedOut: integer('worked_out', { mode: 'boolean' }).default(false),
  workoutType: text('workout_type'),
  workoutNotes: text('workout_notes'),
  notes: text('notes'),
  deviceMetrics: text('device_metrics', { mode: 'json' }),
  createdAt: text('created_at').default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at')
}, (table) => ({
  userDateUnique: uniqueIndex('uix_user_date').on(table.userId, table.date)
}));

// Health Issues table
export const healthIssues = sqliteTable('health_issues', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  dailyEntryId: integer('daily_entry_id').notNull().references(() => dailyEntries.id, { onDelete: 'cascade' }),
  issueType: text('issue_type').notNull(),
  severity: integer('severity'),
  notes: text('notes'),
  timeOfDay: text('time_of_day'),
  createdAt: text('created_at').default('CURRENT_TIMESTAMP')
});

// Issue Types table
export const issueTypes = sqliteTable('issue_types', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull().unique(),
  displayName: text('display_name').notNull(),
  icon: text('icon'),
  isActive: integer('is_active', { mode: 'boolean' }).default(true),
  sortOrder: integer('sort_order').default(0)
});

// Workout Routines table
export const workoutRoutines = sqliteTable('workout_routines', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: text('user_id').notNull().references(() => users.id),
  name: text('name').notNull(),
  description: text('description'),
  isActive: integer('is_active', { mode: 'boolean' }).default(true),
  createdAt: text('created_at').default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at')
});

// Workouts table (formerly workout_days - now standalone without requiring a routine)
export const workoutDays = sqliteTable('workout_days', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: text('user_id').references(() => users.id), // For standalone workouts
  routineId: integer('routine_id').references(() => workoutRoutines.id, { onDelete: 'cascade' }), // Optional - for backwards compatibility
  name: text('name').notNull(),
  dayOfWeek: integer('day_of_week'),
  sortOrder: integer('sort_order').default(0)
});

// Exercises table
export const exercises = sqliteTable('exercises', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  workoutDayId: integer('workout_day_id').notNull().references(() => workoutDays.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  targetSets: integer('target_sets'),
  targetReps: text('target_reps'),
  targetWeight: text('target_weight'),
  restSeconds: integer('rest_seconds'),
  notes: text('notes'),
  sortOrder: integer('sort_order').default(0)
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
  refreshTokens: many(refreshTokens),
  dailyEntries: many(dailyEntries),
  workoutRoutines: many(workoutRoutines),
  workoutDays: many(workoutDays)
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id]
  })
}));

export const refreshTokensRelations = relations(refreshTokens, ({ one }) => ({
  user: one(users, {
    fields: [refreshTokens.userId],
    references: [users.id]
  })
}));

export const dailyEntriesRelations = relations(dailyEntries, ({ one, many }) => ({
  user: one(users, {
    fields: [dailyEntries.userId],
    references: [users.id]
  }),
  healthIssues: many(healthIssues)
}));

export const healthIssuesRelations = relations(healthIssues, ({ one }) => ({
  dailyEntry: one(dailyEntries, {
    fields: [healthIssues.dailyEntryId],
    references: [dailyEntries.id]
  })
}));

export const workoutRoutinesRelations = relations(workoutRoutines, ({ one, many }) => ({
  user: one(users, {
    fields: [workoutRoutines.userId],
    references: [users.id]
  }),
  days: many(workoutDays)
}));

export const workoutDaysRelations = relations(workoutDays, ({ one, many }) => ({
  user: one(users, {
    fields: [workoutDays.userId],
    references: [users.id]
  }),
  routine: one(workoutRoutines, {
    fields: [workoutDays.routineId],
    references: [workoutRoutines.id]
  }), // Optional relation - workouts can exist without a routine
  exercises: many(exercises)
}));

export const exercisesRelations = relations(exercises, ({ one, many }) => ({
  workoutDay: one(workoutDays, {
    fields: [exercises.workoutDayId],
    references: [workoutDays.id]
  }),
  exerciseLogs: many(exerciseLogs)
}));

// Workout Sessions table - tracks active workout sessions
export const workoutSessions = sqliteTable('workout_sessions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  workoutDayId: integer('workout_day_id').notNull().references(() => workoutDays.id, { onDelete: 'cascade' }),
  status: text('status').notNull().default('active'), // 'active', 'completed', 'cancelled'
  startedAt: text('started_at').notNull(),
  completedAt: text('completed_at'),
  notes: text('notes')
});

// Exercise Logs table - tracks individual exercise completions with weight/reps
export const exerciseLogs = sqliteTable('exercise_logs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  sessionId: integer('session_id').notNull().references(() => workoutSessions.id, { onDelete: 'cascade' }),
  exerciseId: integer('exercise_id').notNull().references(() => exercises.id, { onDelete: 'cascade' }),
  setNumber: integer('set_number').notNull(),
  weight: text('weight'),
  reps: integer('reps'),
  isPR: integer('is_pr', { mode: 'boolean' }).default(false),
  completedAt: text('completed_at').notNull()
});

// Relations for workout sessions
export const workoutSessionsRelations = relations(workoutSessions, ({ one, many }) => ({
  workoutDay: one(workoutDays, {
    fields: [workoutSessions.workoutDayId],
    references: [workoutDays.id]
  }),
  exerciseLogs: many(exerciseLogs)
}));

// Relations for exercise logs
export const exerciseLogsRelations = relations(exerciseLogs, ({ one }) => ({
  session: one(workoutSessions, {
    fields: [exerciseLogs.sessionId],
    references: [workoutSessions.id]
  }),
  exercise: one(exercises, {
    fields: [exerciseLogs.exerciseId],
    references: [exercises.id]
  })
}));
