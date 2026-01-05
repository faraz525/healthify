import { db } from './db';
import { issueTypes } from './db/schema';
import { eq, asc } from 'drizzle-orm';

export function getIssueTypes(activeOnly = true) {
  return db.query.issueTypes.findMany({
    where: activeOnly ? eq(issueTypes.isActive, true) : undefined,
    orderBy: [asc(issueTypes.sortOrder)]
  }).sync();
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
