import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from './schema';
import { env } from '$env/dynamic/private';

const DATABASE_URL = env.DATABASE_URL || './data/healthify.db';

const sqlite = new Database(DATABASE_URL);
export const db = drizzle(sqlite, { schema });

// Export sqlite instance for transaction support
export { sqlite };

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
