import { db } from './db';
import { issueTypes } from './db/schema';
import { eq, asc, inArray } from 'drizzle-orm';

// Cache for issue type names to avoid repeated DB queries
let issueTypeNamesCache: Set<string> | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 60000; // 1 minute cache

export function getIssueTypes(activeOnly = true) {
  return db.query.issueTypes.findMany({
    where: activeOnly ? eq(issueTypes.isActive, true) : undefined,
    orderBy: [asc(issueTypes.sortOrder)]
  }).sync();
}

// Check if an issue type name is valid
export function isValidIssueType(typeName: string): boolean {
  try {
    const now = Date.now();

    // Refresh cache if expired or not initialized
    if (!issueTypeNamesCache || (now - cacheTimestamp) > CACHE_TTL_MS) {
      const allTypes = db.query.issueTypes.findMany().sync();
      issueTypeNamesCache = new Set(allTypes.map(t => t.name));
      cacheTimestamp = now;
    }

    return issueTypeNamesCache.has(typeName);
  } catch (err) {
    console.error('Failed to validate issue type:', err);
    return false; // Reject unknown types on error for safety
  }
}

// Validate multiple issue types and return only valid ones
export function filterValidIssueTypes(typeNames: string[]): string[] {
  try {
    const now = Date.now();

    // Refresh cache if expired or not initialized
    if (!issueTypeNamesCache || (now - cacheTimestamp) > CACHE_TTL_MS) {
      const allTypes = db.query.issueTypes.findMany().sync();
      issueTypeNamesCache = new Set(allTypes.map(t => t.name));
      cacheTimestamp = now;
    }

    return typeNames.filter(name => issueTypeNamesCache!.has(name));
  } catch (err) {
    console.error('Failed to filter issue types:', err);
    return []; // Return empty array on error for safety
  }
}

export function createIssueType(data: {
  name: string;
  displayName: string;
  icon?: string;
}) {
  const result = db.insert(issueTypes).values({
    name: data.name,
    displayName: data.displayName,
    icon: data.icon,
    isActive: true,
    sortOrder: 0
  }).returning().all();

  return result[0];
}
