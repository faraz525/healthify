# SvelteKit-Only Migration Implementation Plan

## Overview

Migrate Healthify from a two-container architecture (FastAPI backend + SvelteKit static frontend) to a single SvelteKit application using `adapter-node`. This eliminates the Python backend while preserving all existing functionality and data.

## Current State Analysis

**Architecture:**
- FastAPI backend (Python) with 20+ REST endpoints under `/api`
- SQLite database with SQLAlchemy ORM (synchronous)
- SvelteKit frontend using `adapter-static` served via Nginx
- Docker Compose orchestrating 2 containers

**Database Tables:**
- `daily_entries` - Core health tracking entries
- `health_issues` - Issues linked to entries (one-to-many)
- `issue_types` - Predefined issue categories
- `workout_routines` - Workout plans
- `workout_days` - Days within routines (one-to-many)
- `exercises` - Exercises within days (one-to-many)

**Key Discoveries:**
- Frontend already uses Svelte 5 runes throughout
- All API calls centralized in `frontend/src/lib/api.ts`
- Stores use factory pattern with custom methods
- SQLite database at `./data/healthify.db` must be preserved

## Desired End State

A single SvelteKit application that:
1. Runs as a Node.js server using `@sveltejs/adapter-node`
2. Uses Drizzle ORM + better-sqlite3 for database access
3. Implements all data operations via SvelteKit load functions and form actions
4. Deploys as a single Docker container
5. Preserves all existing data in the SQLite database

### Verification:
- All existing functionality works (calendar, entries, stats, workouts)
- Database contains all previous data
- Single `docker-compose up` starts the application
- No Python/FastAPI dependencies remain

## What We're NOT Doing

- Redesigning the database schema (preserving for data compatibility)
- Adding new features during migration
- Changing the UI/UX design
- Implementing authentication (not in current app)
- Adding real-time features (WebSockets, etc.)

## Implementation Approach

The migration follows an incremental approach:
1. Set up Drizzle ORM schema matching existing database
2. Create server-side database layer in `$lib/server/`
3. Implement load functions and form actions for each route
4. Remove API client and update components to use form actions
5. Switch adapter and simplify Docker deployment

---

## Phase 1: Database Layer Setup

### Overview
Set up Drizzle ORM with better-sqlite3, create schema matching existing tables, and establish the server-side database module.

### Changes Required:

#### 1.1 Install Dependencies

**File**: `frontend/package.json`
**Changes**: Add Drizzle ORM and better-sqlite3 dependencies

```bash
npm install drizzle-orm better-sqlite3
npm install -D drizzle-kit @types/better-sqlite3
```

#### 1.2 Create Drizzle Configuration

**File**: `frontend/drizzle.config.ts` (new file)
**Changes**: Configure Drizzle Kit for SQLite

```typescript
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'sqlite',
  schema: './src/lib/server/db/schema.ts',
  out: './drizzle',
  dbCredentials: {
    url: process.env.DATABASE_URL || './data/healthify.db'
  }
});
```

#### 1.3 Create Database Schema

**File**: `frontend/src/lib/server/db/schema.ts` (new file)
**Changes**: Define Drizzle schema matching existing SQLAlchemy models

```typescript
import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';
import { relations } from 'drizzle-orm';

// Daily Entries table
export const dailyEntries = sqliteTable('daily_entries', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  date: text('date').notNull().unique(),
  stressLevel: integer('stress_level'),
  workedOut: integer('worked_out', { mode: 'boolean' }).default(false),
  workoutNotes: text('workout_notes'),
  notes: text('notes'),
  deviceMetrics: text('device_metrics', { mode: 'json' }),
  createdAt: text('created_at').default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at')
});

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
  name: text('name').notNull(),
  description: text('description'),
  isActive: integer('is_active', { mode: 'boolean' }).default(true),
  createdAt: text('created_at').default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at')
});

// Workout Days table
export const workoutDays = sqliteTable('workout_days', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  routineId: integer('routine_id').notNull().references(() => workoutRoutines.id, { onDelete: 'cascade' }),
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
export const dailyEntriesRelations = relations(dailyEntries, ({ many }) => ({
  healthIssues: many(healthIssues)
}));

export const healthIssuesRelations = relations(healthIssues, ({ one }) => ({
  dailyEntry: one(dailyEntries, {
    fields: [healthIssues.dailyEntryId],
    references: [dailyEntries.id]
  })
}));

export const workoutRoutinesRelations = relations(workoutRoutines, ({ many }) => ({
  days: many(workoutDays)
}));

export const workoutDaysRelations = relations(workoutDays, ({ one, many }) => ({
  routine: one(workoutRoutines, {
    fields: [workoutDays.routineId],
    references: [workoutRoutines.id]
  }),
  exercises: many(exercises)
}));

export const exercisesRelations = relations(exercises, ({ one }) => ({
  workoutDay: one(workoutDays, {
    fields: [exercises.workoutDayId],
    references: [workoutDays.id]
  })
}));
```

#### 1.4 Create Database Connection

**File**: `frontend/src/lib/server/db/index.ts` (new file)
**Changes**: Initialize Drizzle with better-sqlite3

```typescript
import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from './schema';
import { env } from '$env/dynamic/private';

const DATABASE_URL = env.DATABASE_URL || './data/healthify.db';

const sqlite = new Database(DATABASE_URL);
export const db = drizzle(sqlite, { schema });

// Seed default issue types if none exist
export function seedDefaultIssueTypes() {
  const existing = sqlite.prepare('SELECT COUNT(*) as count FROM issue_types').get() as { count: number };

  if (existing.count === 0) {
    const defaultTypes = [
      { name: 'heart_palpitations', displayName: 'Heart Palpitations', icon: 'heart', sortOrder: 1 },
      { name: 'headache', displayName: 'Headache', icon: 'brain', sortOrder: 2 },
      { name: 'fatigue', displayName: 'Fatigue', icon: 'battery-low', sortOrder: 3 },
      { name: 'anxiety', displayName: 'Anxiety', icon: 'alert-circle', sortOrder: 4 },
      { name: 'digestive_issues', displayName: 'Digestive Issues', icon: 'stomach', sortOrder: 5 },
      { name: 'sleep_issues', displayName: 'Sleep Issues', icon: 'moon', sortOrder: 6 },
      { name: 'muscle_pain', displayName: 'Muscle Pain', icon: 'activity', sortOrder: 7 },
      { name: 'dizziness', displayName: 'Dizziness', icon: 'compass', sortOrder: 8 },
      { name: 'other', displayName: 'Other', icon: 'plus-circle', sortOrder: 99 }
    ];

    const stmt = sqlite.prepare(`
      INSERT INTO issue_types (name, display_name, icon, sort_order, is_active)
      VALUES (?, ?, ?, ?, 1)
    `);

    for (const type of defaultTypes) {
      stmt.run(type.name, type.displayName, type.icon, type.sortOrder);
    }
  }
}
```

#### 1.5 Create Data Directory

**File**: `frontend/data/.gitkeep` (new file)
**Changes**: Ensure data directory exists for SQLite database

```
# This directory holds the SQLite database
```

#### 1.6 Update .gitignore

**File**: `frontend/.gitignore`
**Changes**: Add database and drizzle files

```gitignore
# Database
data/*.db
data/*.db-journal

# Drizzle
drizzle/
```

### Success Criteria:

#### Automated Verification:
- [x] Dependencies install cleanly: `cd frontend && npm install`
- [x] TypeScript compiles without errors: `npm run check`
- [ ] Drizzle can introspect existing database: `npx drizzle-kit introspect`

#### Manual Verification:
- [ ] Schema matches existing database structure
- [ ] Database connection works with existing `healthify.db` file

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation that the database connection works with the existing data before proceeding to the next phase.

---

## Phase 2: Implement Server-Side Data Operations

### Overview
Create CRUD operations in `$lib/server/` that mirror the existing FastAPI endpoints, using Drizzle ORM queries.

### Changes Required:

#### 2.1 Create Entry Operations

**File**: `frontend/src/lib/server/entries.ts` (new file)
**Changes**: Implement all daily entry CRUD operations

```typescript
import { db } from './db';
import { dailyEntries, healthIssues } from './db/schema';
import { eq, desc, gte, lte, and, sql } from 'drizzle-orm';

export type EntryInput = {
  date: string;
  stressLevel?: number | null;
  workedOut?: boolean;
  workoutNotes?: string | null;
  notes?: string | null;
  healthIssues?: Array<{
    issueType: string;
    severity?: number | null;
    notes?: string | null;
    timeOfDay?: string | null;
  }>;
};

export async function getEntryByDate(date: string) {
  const entry = await db.query.dailyEntries.findFirst({
    where: eq(dailyEntries.date, date),
    with: { healthIssues: true }
  });
  return entry;
}

export async function getEntries(options: {
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
} = {}) {
  const { startDate, endDate, limit = 30, offset = 0 } = options;

  const conditions = [];
  if (startDate) conditions.push(gte(dailyEntries.date, startDate));
  if (endDate) conditions.push(lte(dailyEntries.date, endDate));

  const entries = await db.query.dailyEntries.findMany({
    where: conditions.length > 0 ? and(...conditions) : undefined,
    with: { healthIssues: true },
    orderBy: [desc(dailyEntries.date)],
    limit: Math.min(limit, 100),
    offset
  });

  return entries;
}

export async function createEntry(data: EntryInput) {
  const { healthIssues: issues, ...entryData } = data;

  const [entry] = await db.insert(dailyEntries).values({
    date: entryData.date,
    stressLevel: entryData.stressLevel,
    workedOut: entryData.workedOut ?? false,
    workoutNotes: entryData.workoutNotes,
    notes: entryData.notes
  }).returning();

  if (issues && issues.length > 0) {
    await db.insert(healthIssues).values(
      issues.map(issue => ({
        dailyEntryId: entry.id,
        issueType: issue.issueType,
        severity: issue.severity,
        notes: issue.notes,
        timeOfDay: issue.timeOfDay
      }))
    );
  }

  return getEntryByDate(data.date);
}

export async function updateEntry(date: string, data: Partial<EntryInput>) {
  const existing = await getEntryByDate(date);
  if (!existing) return null;

  const { healthIssues: issues, ...entryData } = data;

  // Update entry fields
  if (Object.keys(entryData).length > 0) {
    await db.update(dailyEntries)
      .set({
        ...entryData,
        updatedAt: new Date().toISOString()
      })
      .where(eq(dailyEntries.date, date));
  }

  // Replace health issues if provided
  if (issues !== undefined) {
    await db.delete(healthIssues).where(eq(healthIssues.dailyEntryId, existing.id));

    if (issues.length > 0) {
      await db.insert(healthIssues).values(
        issues.map(issue => ({
          dailyEntryId: existing.id,
          issueType: issue.issueType,
          severity: issue.severity,
          notes: issue.notes,
          timeOfDay: issue.timeOfDay
        }))
      );
    }
  }

  return getEntryByDate(date);
}

export async function deleteEntry(date: string) {
  const existing = await getEntryByDate(date);
  if (!existing) return false;

  await db.delete(dailyEntries).where(eq(dailyEntries.date, date));
  return true;
}

export async function getTodayEntry() {
  const today = new Date().toISOString().split('T')[0];
  return getEntryByDate(today);
}
```

#### 2.2 Create Issue Types Operations

**File**: `frontend/src/lib/server/issueTypes.ts` (new file)
**Changes**: Implement issue type operations

```typescript
import { db } from './db';
import { issueTypes } from './db/schema';
import { eq, asc } from 'drizzle-orm';

export async function getIssueTypes(activeOnly = true) {
  return db.query.issueTypes.findMany({
    where: activeOnly ? eq(issueTypes.isActive, true) : undefined,
    orderBy: [asc(issueTypes.sortOrder)]
  });
}

export async function createIssueType(data: {
  name: string;
  displayName: string;
  icon?: string;
}) {
  const [issueType] = await db.insert(issueTypes).values({
    name: data.name,
    displayName: data.displayName,
    icon: data.icon,
    isActive: true,
    sortOrder: 0
  }).returning();

  return issueType;
}
```

#### 2.3 Create Stats Operations

**File**: `frontend/src/lib/server/stats.ts` (new file)
**Changes**: Implement statistics calculations

```typescript
import { db } from './db';
import { dailyEntries, healthIssues } from './db/schema';
import { gte, sql, desc, eq, and } from 'drizzle-orm';

export async function getStats(days = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  const startDateStr = startDate.toISOString().split('T')[0];

  // Get entries in date range
  const entries = await db.query.dailyEntries.findMany({
    where: gte(dailyEntries.date, startDateStr),
    with: { healthIssues: true }
  });

  const totalEntries = entries.length;
  const workoutDays = entries.filter(e => e.workedOut).length;

  // Calculate average stress
  const stressLevels = entries
    .map(e => e.stressLevel)
    .filter((s): s is number => s !== null && s !== undefined);
  const avgStress = stressLevels.length > 0
    ? Math.round((stressLevels.reduce((a, b) => a + b, 0) / stressLevels.length) * 10) / 10
    : null;

  // Get common issues
  const issueCountsResult = await db
    .select({
      issueType: healthIssues.issueType,
      count: sql<number>`count(*)`.as('count')
    })
    .from(healthIssues)
    .innerJoin(dailyEntries, eq(healthIssues.dailyEntryId, dailyEntries.id))
    .where(gte(dailyEntries.date, startDateStr))
    .groupBy(healthIssues.issueType)
    .orderBy(desc(sql`count(*)`))
    .limit(5);

  const commonIssues = issueCountsResult.map(r => ({
    issue_type: r.issueType,
    count: r.count
  }));

  // Calculate streak
  let streakDays = 0;
  const today = new Date();

  for (let i = 0; i < 365; i++) {
    const checkDate = new Date(today);
    checkDate.setDate(checkDate.getDate() - i);
    const dateStr = checkDate.toISOString().split('T')[0];

    const hasEntry = entries.some(e => e.date === dateStr);
    if (hasEntry) {
      streakDays++;
    } else {
      break;
    }
  }

  return {
    total_entries: totalEntries,
    workout_days: workoutDays,
    avg_stress: avgStress,
    common_issues: commonIssues,
    streak_days: streakDays
  };
}
```

#### 2.4 Create Workout Operations

**File**: `frontend/src/lib/server/workouts.ts` (new file)
**Changes**: Implement workout routine CRUD operations

```typescript
import { db } from './db';
import { workoutRoutines, workoutDays, exercises } from './db/schema';
import { eq, asc } from 'drizzle-orm';

export async function getWorkoutRoutines(activeOnly = true) {
  return db.query.workoutRoutines.findMany({
    where: activeOnly ? eq(workoutRoutines.isActive, true) : undefined,
    with: {
      days: {
        with: { exercises: true },
        orderBy: [asc(workoutDays.sortOrder)]
      }
    }
  });
}

export async function getWorkoutRoutine(id: number) {
  return db.query.workoutRoutines.findFirst({
    where: eq(workoutRoutines.id, id),
    with: {
      days: {
        with: { exercises: true },
        orderBy: [asc(workoutDays.sortOrder)]
      }
    }
  });
}

export async function getTodaysWorkout() {
  // JavaScript: Sunday=0, Monday=1... we need Monday=0
  const jsDay = new Date().getDay();
  const dayOfWeek = jsDay === 0 ? 6 : jsDay - 1;

  const activeRoutine = await db.query.workoutRoutines.findFirst({
    where: eq(workoutRoutines.isActive, true)
  });

  if (!activeRoutine) return null;

  return db.query.workoutDays.findFirst({
    where: eq(workoutDays.routineId, activeRoutine.id) && eq(workoutDays.dayOfWeek, dayOfWeek),
    with: { exercises: true }
  });
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

export async function createWorkoutRoutine(data: WorkoutRoutineInput) {
  const [routine] = await db.insert(workoutRoutines).values({
    name: data.name,
    description: data.description,
    isActive: true
  }).returning();

  if (data.days && data.days.length > 0) {
    for (const dayData of data.days) {
      const [day] = await db.insert(workoutDays).values({
        routineId: routine.id,
        name: dayData.name,
        dayOfWeek: dayData.dayOfWeek,
        sortOrder: dayData.sortOrder ?? 0
      }).returning();

      if (dayData.exercises && dayData.exercises.length > 0) {
        await db.insert(exercises).values(
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
        );
      }
    }
  }

  return getWorkoutRoutine(routine.id);
}

export async function updateWorkoutRoutine(id: number, data: Partial<{
  name: string;
  description: string;
  isActive: boolean;
}>) {
  await db.update(workoutRoutines)
    .set({ ...data, updatedAt: new Date().toISOString() })
    .where(eq(workoutRoutines.id, id));

  return getWorkoutRoutine(id);
}

export async function deleteWorkoutRoutine(id: number) {
  const existing = await getWorkoutRoutine(id);
  if (!existing) return false;

  await db.delete(workoutRoutines).where(eq(workoutRoutines.id, id));
  return true;
}

// Workout Day operations
export async function createWorkoutDay(routineId: number, data: {
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
  const routine = await getWorkoutRoutine(routineId);
  if (!routine) return null;

  const [day] = await db.insert(workoutDays).values({
    routineId,
    name: data.name,
    dayOfWeek: data.dayOfWeek,
    sortOrder: data.sortOrder ?? 0
  }).returning();

  if (data.exercises && data.exercises.length > 0) {
    await db.insert(exercises).values(
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
    );
  }

  return db.query.workoutDays.findFirst({
    where: eq(workoutDays.id, day.id),
    with: { exercises: true }
  });
}

export async function updateWorkoutDay(dayId: number, data: Partial<{
  name: string;
  dayOfWeek: number | null;
  sortOrder: number;
}>) {
  await db.update(workoutDays).set(data).where(eq(workoutDays.id, dayId));

  return db.query.workoutDays.findFirst({
    where: eq(workoutDays.id, dayId),
    with: { exercises: true }
  });
}

export async function deleteWorkoutDay(dayId: number) {
  const existing = await db.query.workoutDays.findFirst({
    where: eq(workoutDays.id, dayId)
  });
  if (!existing) return false;

  await db.delete(workoutDays).where(eq(workoutDays.id, dayId));
  return true;
}

// Exercise operations
export async function createExercise(dayId: number, data: {
  name: string;
  targetSets?: number;
  targetReps?: string;
  targetWeight?: string;
  restSeconds?: number;
  notes?: string;
  sortOrder?: number;
}) {
  const day = await db.query.workoutDays.findFirst({
    where: eq(workoutDays.id, dayId)
  });
  if (!day) return null;

  const [exercise] = await db.insert(exercises).values({
    workoutDayId: dayId,
    ...data,
    sortOrder: data.sortOrder ?? 0
  }).returning();

  return exercise;
}

export async function updateExercise(exerciseId: number, data: Partial<{
  name: string;
  targetSets: number;
  targetReps: string;
  targetWeight: string;
  restSeconds: number;
  notes: string;
  sortOrder: number;
}>) {
  await db.update(exercises).set(data).where(eq(exercises.id, exerciseId));

  return db.query.exercises.findFirst({
    where: eq(exercises.id, exerciseId)
  });
}

export async function deleteExercise(exerciseId: number) {
  const existing = await db.query.exercises.findFirst({
    where: eq(exercises.id, exerciseId)
  });
  if (!existing) return false;

  await db.delete(exercises).where(eq(exercises.id, exerciseId));
  return true;
}
```

### Success Criteria:

#### Automated Verification:
- [ ] TypeScript compiles without errors: `npm run check`
- [ ] All server modules can be imported without runtime errors

#### Manual Verification:
- [ ] Test each operation manually by importing in a test script
- [ ] Verify data reads match existing database content

**Implementation Note**: After completing this phase, verify that all CRUD operations work correctly with the existing database before proceeding.

---

## Phase 3: Implement SvelteKit Load Functions and Form Actions

### Overview
Create `+page.server.ts` files for each route to handle data loading and mutations using SvelteKit's native patterns.

### Changes Required:

#### 3.1 Root Layout Server Load

**File**: `frontend/src/routes/+layout.server.ts` (new file)
**Changes**: Load initial data (issue types) for entire app

```typescript
import type { LayoutServerLoad } from './$types';
import { getIssueTypes } from '$lib/server/issueTypes';
import { seedDefaultIssueTypes } from '$lib/server/db';

// Seed on first request
let seeded = false;

export const load: LayoutServerLoad = async () => {
  if (!seeded) {
    seedDefaultIssueTypes();
    seeded = true;
  }

  const issueTypes = await getIssueTypes();

  return {
    issueTypes
  };
};
```

#### 3.2 Main Page (Calendar) Server Load and Actions

**File**: `frontend/src/routes/+page.server.ts` (new file)
**Changes**: Handle entry CRUD operations

```typescript
import type { PageServerLoad, Actions } from './$types';
import { fail } from '@sveltejs/kit';
import { getEntries, getEntryByDate, createEntry, updateEntry, deleteEntry, getTodayEntry } from '$lib/server/entries';
import { getStats } from '$lib/server/stats';

export const load: PageServerLoad = async () => {
  // Load entries for 3 month range (1 month ago to 2 months ahead)
  const now = new Date();
  const startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0];
  const endDate = new Date(now.getFullYear(), now.getMonth() + 3, 0).toISOString().split('T')[0];

  const [entries, todayEntry, stats] = await Promise.all([
    getEntries({ startDate, endDate, limit: 100 }),
    getTodayEntry(),
    getStats(7)
  ]);

  return {
    entries,
    todayEntry,
    stats
  };
};

export const actions: Actions = {
  createEntry: async ({ request }) => {
    const formData = await request.formData();
    const data = JSON.parse(formData.get('data') as string);

    // Check if entry already exists
    const existing = await getEntryByDate(data.date);
    if (existing) {
      return fail(400, { error: 'Entry already exists for this date' });
    }

    const entry = await createEntry(data);
    return { success: true, entry };
  },

  updateEntry: async ({ request }) => {
    const formData = await request.formData();
    const date = formData.get('date') as string;
    const data = JSON.parse(formData.get('data') as string);

    const entry = await updateEntry(date, data);
    if (!entry) {
      return fail(404, { error: 'Entry not found' });
    }

    return { success: true, entry };
  },

  deleteEntry: async ({ request }) => {
    const formData = await request.formData();
    const date = formData.get('date') as string;

    const deleted = await deleteEntry(date);
    if (!deleted) {
      return fail(404, { error: 'Entry not found' });
    }

    return { success: true };
  }
};
```

#### 3.3 Stats Page Server Load

**File**: `frontend/src/routes/stats/+page.server.ts` (new file)
**Changes**: Load statistics with period parameter

```typescript
import type { PageServerLoad } from './$types';
import { getStats } from '$lib/server/stats';

export const load: PageServerLoad = async ({ url }) => {
  const days = parseInt(url.searchParams.get('days') || '30');
  const validDays = Math.min(Math.max(days, 1), 365);

  const stats = await getStats(validDays);

  return {
    stats,
    period: validDays
  };
};
```

#### 3.4 Workouts Page Server Load and Actions

**File**: `frontend/src/routes/workouts/+page.server.ts` (new file)
**Changes**: Handle workout CRUD operations

```typescript
import type { PageServerLoad, Actions } from './$types';
import { fail } from '@sveltejs/kit';
import {
  getWorkoutRoutines,
  getWorkoutRoutine,
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
  const [routines, todaysWorkout] = await Promise.all([
    getWorkoutRoutines(),
    getTodaysWorkout()
  ]);

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

    const routine = await createWorkoutRoutine({ name, description });
    return { success: true, routine };
  },

  updateRoutine: async ({ request }) => {
    const formData = await request.formData();
    const id = parseInt(formData.get('id') as string);
    const data = JSON.parse(formData.get('data') as string);

    const routine = await updateWorkoutRoutine(id, data);
    if (!routine) {
      return fail(404, { error: 'Routine not found' });
    }

    return { success: true, routine };
  },

  deleteRoutine: async ({ request }) => {
    const formData = await request.formData();
    const id = parseInt(formData.get('id') as string);

    const deleted = await deleteWorkoutRoutine(id);
    if (!deleted) {
      return fail(404, { error: 'Routine not found' });
    }

    return { success: true };
  },

  createDay: async ({ request }) => {
    const formData = await request.formData();
    const routineId = parseInt(formData.get('routineId') as string);
    const data = JSON.parse(formData.get('data') as string);

    const day = await createWorkoutDay(routineId, data);
    if (!day) {
      return fail(404, { error: 'Routine not found' });
    }

    return { success: true, day };
  },

  updateDay: async ({ request }) => {
    const formData = await request.formData();
    const dayId = parseInt(formData.get('dayId') as string);
    const data = JSON.parse(formData.get('data') as string);

    const day = await updateWorkoutDay(dayId, data);
    if (!day) {
      return fail(404, { error: 'Day not found' });
    }

    return { success: true, day };
  },

  deleteDay: async ({ request }) => {
    const formData = await request.formData();
    const dayId = parseInt(formData.get('dayId') as string);

    const deleted = await deleteWorkoutDay(dayId);
    if (!deleted) {
      return fail(404, { error: 'Day not found' });
    }

    return { success: true };
  },

  createExercise: async ({ request }) => {
    const formData = await request.formData();
    const dayId = parseInt(formData.get('dayId') as string);
    const data = JSON.parse(formData.get('data') as string);

    const exercise = await createExercise(dayId, data);
    if (!exercise) {
      return fail(404, { error: 'Day not found' });
    }

    return { success: true, exercise };
  },

  updateExercise: async ({ request }) => {
    const formData = await request.formData();
    const exerciseId = parseInt(formData.get('exerciseId') as string);
    const data = JSON.parse(formData.get('data') as string);

    const exercise = await updateExercise(exerciseId, data);
    if (!exercise) {
      return fail(404, { error: 'Exercise not found' });
    }

    return { success: true, exercise };
  },

  deleteExercise: async ({ request }) => {
    const formData = await request.formData();
    const exerciseId = parseInt(formData.get('exerciseId') as string);

    const deleted = await deleteExercise(exerciseId);
    if (!deleted) {
      return fail(404, { error: 'Exercise not found' });
    }

    return { success: true };
  }
};
```

### Success Criteria:

#### Automated Verification:
- [ ] TypeScript compiles without errors: `npm run check`
- [ ] No import errors for server modules

#### Manual Verification:
- [ ] Load functions return correct data structure
- [ ] Form actions process data correctly

**Implementation Note**: After completing this phase, test that the server-side data loading works before updating the frontend components.

---

## Phase 4: Update Frontend Components

### Overview
Modify Svelte components to use data from load functions and submit forms via SvelteKit form actions instead of the API client.

### Changes Required:

#### 4.1 Update Root Layout

**File**: `frontend/src/routes/+layout.svelte`
**Changes**:
- Remove onMount data loading
- Use data from load function
- Remove issueTypes store initialization

```svelte
<script lang="ts">
  import '../app.css';
  import { onMount } from 'svelte';
  import EntryModal from '$lib/components/EntryModal.svelte';
  import Toast from '$lib/components/Toast.svelte';
  import { modalOpen } from '$lib/stores/ui';
  import { setIssueTypes } from '$lib/stores/issueTypes';

  let { children, data } = $props();
  let mobileMenuOpen = $state(false);

  // Set issue types from server data
  $effect(() => {
    if (data.issueTypes) {
      setIssueTypes(data.issueTypes);
    }
  });
</script>

<!-- Rest of template stays the same, but remove loading state -->
```

#### 4.2 Update Main Page

**File**: `frontend/src/routes/+page.svelte`
**Changes**: Use server data and form actions

```svelte
<script lang="ts">
  import Calendar from '$lib/components/Calendar.svelte';
  import { enhance } from '$app/forms';

  let { data } = $props();

  // Derive values from server data
  let todayEntry = $derived(data.todayEntry);
  let stats = $derived(data.stats);
  let entries = $derived(data.entries);

  function getGreeting() {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  }
</script>

<!-- Rest stays similar, but entries come from data prop -->
```

#### 4.3 Update EntryModal Component

**File**: `frontend/src/lib/components/EntryModal.svelte`
**Changes**: Use form actions instead of API calls

```svelte
<script lang="ts">
  import { enhance } from '$app/forms';
  import { invalidateAll } from '$app/navigation';
  import StressSlider from './StressSlider.svelte';
  import WorkoutToggle from './WorkoutToggle.svelte';
  import IssueSelector from './IssueSelector.svelte';
  import { selectedDate, closeModal, showToast } from '$lib/stores/ui';
  import { issueTypes } from '$lib/stores/issueTypes';

  let { entries = [] }: { entries: any[] } = $props();

  let date = $derived($selectedDate);
  let existingEntry = $derived(date ? entries.find(e => e.date === date) : undefined);
  let isEditing = $derived(!!existingEntry);

  // Form state
  let stressLevel = $state<number | null>(null);
  let workedOut = $state(false);
  let workoutNotes = $state('');
  let notes = $state('');
  let healthIssues = $state<any[]>([]);
  let saving = $state(false);

  // Populate form when date changes
  $effect(() => {
    if (existingEntry) {
      stressLevel = existingEntry.stressLevel ?? null;
      workedOut = existingEntry.workedOut ?? false;
      workoutNotes = existingEntry.workoutNotes ?? '';
      notes = existingEntry.notes ?? '';
      healthIssues = existingEntry.healthIssues?.map((i: any) => ({ ...i })) ?? [];
    } else {
      stressLevel = null;
      workedOut = false;
      workoutNotes = '';
      notes = '';
      healthIssues = [];
    }
  });

  function getFormData() {
    return JSON.stringify({
      date,
      stressLevel,
      workedOut,
      workoutNotes: workedOut ? workoutNotes : null,
      notes: notes || null,
      healthIssues: healthIssues.map(i => ({
        issueType: i.issueType,
        severity: i.severity,
        notes: i.notes,
        timeOfDay: i.timeOfDay
      }))
    });
  }
</script>

<div class="modal-backdrop" onclick={() => closeModal()}>
  <div class="modal" onclick={(e) => e.stopPropagation()}>
    <div class="modal-header">
      <h2>{isEditing ? 'Edit Entry' : 'New Entry'}</h2>
      <span class="date">{date}</span>
    </div>

    <div class="modal-body">
      <!-- Stress Level -->
      <div class="form-section">
        <label>Stress Level</label>
        <StressSlider bind:value={stressLevel} />
      </div>

      <!-- Workout -->
      <div class="form-section">
        <label>Workout</label>
        <WorkoutToggle bind:checked={workedOut} />
        {#if workedOut}
          <textarea
            bind:value={workoutNotes}
            placeholder="Workout notes..."
            class="workout-notes"
          ></textarea>
        {/if}
      </div>

      <!-- Health Issues -->
      <div class="form-section">
        <label>Health Issues</label>
        <IssueSelector bind:issues={healthIssues} issueTypes={$issueTypes} />
      </div>

      <!-- Notes -->
      <div class="form-section">
        <label>Notes</label>
        <textarea
          bind:value={notes}
          placeholder="Any other notes for today..."
          rows="3"
        ></textarea>
      </div>
    </div>

    <div class="modal-footer">
      {#if isEditing}
        <form
          method="POST"
          action="?/deleteEntry"
          use:enhance={() => {
            if (!confirm('Delete this entry?')) return;
            saving = true;
            return async ({ result }) => {
              saving = false;
              if (result.type === 'success') {
                showToast('Entry deleted', 'success');
                closeModal();
                await invalidateAll();
              }
            };
          }}
        >
          <input type="hidden" name="date" value={date} />
          <button type="submit" class="btn-danger" disabled={saving}>Delete</button>
        </form>
      {/if}

      <div class="right-buttons">
        <button type="button" class="btn-secondary" onclick={() => closeModal()}>
          Cancel
        </button>

        <form
          method="POST"
          action={isEditing ? '?/updateEntry' : '?/createEntry'}
          use:enhance={() => {
            saving = true;
            return async ({ result }) => {
              saving = false;
              if (result.type === 'success') {
                showToast(isEditing ? 'Entry updated' : 'Entry created', 'success');
                closeModal();
                await invalidateAll();
              } else if (result.type === 'failure') {
                showToast(result.data?.error || 'Error saving entry', 'error');
              }
            };
          }}
        >
          {#if isEditing}
            <input type="hidden" name="date" value={date} />
          {/if}
          <input type="hidden" name="data" value={getFormData()} />
          <button type="submit" class="btn-primary" disabled={saving}>
            {saving ? 'Saving...' : 'Save'}
          </button>
        </form>
      </div>
    </div>
  </div>
</div>
```

#### 4.4 Update Stats Page

**File**: `frontend/src/routes/stats/+page.svelte`
**Changes**: Use server data and URL-based period selection

```svelte
<script lang="ts">
  import { goto } from '$app/navigation';
  import StatsCard from '$lib/components/StatsCard.svelte';

  let { data } = $props();

  let stats = $derived(data.stats);
  let period = $derived(data.period);

  function handlePeriodChange(event: Event) {
    const newPeriod = (event.target as HTMLSelectElement).value;
    goto(`/stats?days=${newPeriod}`);
  }
</script>

<!-- Rest of template stays similar, using stats from data prop -->
```

#### 4.5 Update Workouts Page

**File**: `frontend/src/routes/workouts/+page.svelte`
**Changes**: Use server data and form actions for all CRUD operations

The workouts page will need significant updates to use form actions. Each operation (create routine, add day, add exercise, etc.) becomes a form submission with `use:enhance`.

#### 4.6 Remove Old API Client and Stores

**Files to delete**:
- `frontend/src/lib/api.ts`
- `frontend/src/lib/stores/entries.ts`

**File to update**: `frontend/src/lib/stores/issueTypes.ts`
- Convert to a simple writable store that gets set from server data

**File to update**: `frontend/src/lib/stores/ui.ts`
- Keep as-is (only manages UI state)

### Success Criteria:

#### Automated Verification:
- [ ] TypeScript compiles without errors: `npm run check`
- [ ] Build completes without errors: `npm run build`
- [ ] No references to old API client remain

#### Manual Verification:
- [ ] Calendar displays existing entries correctly
- [ ] Creating new entries works
- [ ] Updating entries works
- [ ] Deleting entries works
- [ ] Stats page loads and displays correctly
- [ ] Workouts page full CRUD works
- [ ] Toast notifications appear correctly

**Implementation Note**: This is the largest phase. Test each component individually after updating it.

---

## Phase 5: Update Build and Deployment Configuration

### Overview
Switch from `adapter-static` to `adapter-node` and simplify Docker deployment to a single container.

### Changes Required:

#### 5.1 Install Node Adapter

```bash
cd frontend
npm uninstall @sveltejs/adapter-static
npm install @sveltejs/adapter-node
```

#### 5.2 Update SvelteKit Config

**File**: `frontend/svelte.config.js`
**Changes**: Switch to node adapter

```javascript
import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter({
      out: 'build',
      precompress: true,
      envPrefix: ''
    })
  }
};

export default config;
```

#### 5.3 Create New Dockerfile

**File**: `frontend/Dockerfile`
**Changes**: Build and run as Node.js server

```dockerfile
FROM node:22-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy source and build
COPY . .
RUN npm run build

# Production stage
FROM node:22-alpine

WORKDIR /app

# Copy built application
COPY --from=builder /app/build ./build
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules

# Create data directory
RUN mkdir -p /app/data

# Expose port
EXPOSE 3000

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0
ENV DATABASE_URL=/app/data/healthify.db

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/ || exit 1

# Start server
CMD ["node", "build"]
```

#### 5.4 Update Docker Compose

**File**: `docker-compose.yml`
**Changes**: Single container deployment

```yaml
version: '3.8'

services:
  healthify:
    build: ./frontend
    container_name: healthify
    restart: unless-stopped
    ports:
      - "3000:3000"
    volumes:
      - ./data:/app/data
    environment:
      - DATABASE_URL=/app/data/healthify.db
      - NODE_ENV=production

volumes:
  healthify-data:
```

#### 5.5 Update Environment Example

**File**: `.env.example`
**Changes**: Simplify to just database URL

```env
# Database
DATABASE_URL=./data/healthify.db
```

#### 5.6 Clean Up Backend Directory

**Action**: Remove the entire `backend/` directory after migration is complete and verified

### Success Criteria:

#### Automated Verification:
- [ ] Build completes: `cd frontend && npm run build`
- [ ] Application starts: `node frontend/build`
- [ ] Docker build succeeds: `docker-compose build`
- [ ] Docker container starts: `docker-compose up -d`
- [ ] Health check passes: `curl http://localhost:3000/`

#### Manual Verification:
- [ ] Application accessible at http://localhost:3000
- [ ] All features work in Docker deployment
- [ ] Data persists across container restarts
- [ ] Existing data from `./data/healthify.db` is accessible

**Implementation Note**: Test thoroughly in Docker before removing the backend directory.

---

## Testing Strategy

### Unit Tests:
- Test Drizzle schema can query existing database
- Test each CRUD operation in isolation
- Test stats calculations with known data

### Integration Tests:
- Test load functions return correct data structure
- Test form actions process data correctly
- Test full page rendering with server data

### Manual Testing Steps:
1. Start application: `npm run dev`
2. Verify calendar loads with existing entries
3. Create a new entry for today
4. Edit the entry (change stress level, add issues)
5. Delete the entry
6. Navigate to stats page, change period
7. Navigate to workouts page
8. Create a new workout routine with days and exercises
9. Edit exercise details
10. Delete workout routine
11. Test in Docker: `docker-compose up --build`
12. Verify data persists after container restart

---

## Performance Considerations

- **better-sqlite3** is synchronous but very fast for local file access
- **Drizzle ORM** adds minimal overhead with type-safe queries
- SvelteKit's load functions run on the server, reducing client JavaScript
- Form actions provide progressive enhancement (works without JS)

---

## Migration Notes

### Data Preservation:
- Existing SQLite database (`./data/healthify.db`) will be used directly
- No schema changes required - Drizzle schema matches SQLAlchemy exactly
- Run `npx drizzle-kit introspect` to verify schema compatibility

### Rollback Plan:
1. Keep backend directory until migration is fully verified
2. Docker Compose can easily switch back to two-container setup
3. Database file remains unchanged throughout migration

---

## References

- Original CLAUDE.md project documentation
- SvelteKit documentation: https://kit.svelte.dev/docs
- Drizzle ORM documentation: https://orm.drizzle.team/docs
- better-sqlite3: https://github.com/WiseLibs/better-sqlite3
