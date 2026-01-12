import { db } from './db';
import { users, sessions } from './db/schema';
import { eq, and, gt } from 'drizzle-orm';
import crypto from 'crypto';

// Safe parseInt with fallback
function safeParseInt(value: string | null | undefined, fallback: number): number {
  if (value === null || value === undefined) return fallback;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? fallback : parsed;
}

const SESSION_DURATION_DAYS = 30;

export type User = {
  id: string;
  email: string;
  role: string | null;
};

function hashPassword(password: string, salt: string): string {
  return crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
}

function verifyPassword(password: string, storedHash: string): boolean {
  // The old backend used bcrypt, stored as $2b$12$...
  // We need to handle bcrypt hashes
  if (storedHash.startsWith('$2')) {
    // This is a bcrypt hash - we can't verify it without bcrypt
    // For now, we'll need to use a different approach
    // Let's check if bcrypt is available or use a simple comparison for migration
    try {
      // Dynamic import won't work in sync context, so we'll handle this differently
      // For bcrypt passwords, we'll need to add bcrypt package
      return false;
    } catch {
      return false;
    }
  }

  // For new PBKDF2 passwords (salt:hash format)
  const [salt, hash] = storedHash.split(':');
  if (!salt || !hash) return false;

  const verifyHash = hashPassword(password, salt);
  return hash === verifyHash;
}

export function createSession(userId: string): string {
  const sessionId = crypto.randomUUID();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + SESSION_DURATION_DAYS);

  try {
    db.insert(sessions).values({
      id: sessionId,
      userId,
      expiresAt: expiresAt.toISOString()
    }).run();
  } catch (err) {
    console.error('Failed to create session:', err);
    throw new Error('Failed to create session');
  }

  return sessionId;
}

export function validateSession(sessionId: string): User | null {
  if (!sessionId) return null;

  try {
    const now = new Date().toISOString();

    const session = db.query.sessions.findFirst({
      where: and(
        eq(sessions.id, sessionId),
        gt(sessions.expiresAt, now)
      ),
      with: { user: true }
    }).sync();

    if (!session || !session.user) return null;

    return {
      id: session.user.id,
      email: session.user.email,
      role: session.user.role
    };
  } catch (err) {
    console.error('Failed to validate session:', err);
    return null;
  }
}

export function deleteSession(sessionId: string): void {
  try {
    db.delete(sessions).where(eq(sessions.id, sessionId)).run();
  } catch (err) {
    console.error('Failed to delete session:', err);
    // Don't throw - session deletion failure shouldn't break logout flow
  }
}

export function getUserByEmail(email: string) {
  try {
    return db.query.users.findFirst({
      where: eq(users.email, email.toLowerCase())
    }).sync();
  } catch (err) {
    console.error('Failed to get user by email:', err);
    return undefined;
  }
}

export async function verifyLogin(email: string, password: string): Promise<User | null> {
  try {
    const user = getUserByEmail(email);
    if (!user) return null;

    // Handle bcrypt passwords from old backend
    if (user.passwordHash.startsWith('$2')) {
      try {
        const bcrypt = await import('bcrypt');
        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;
      } catch (err) {
        console.error('Failed to verify bcrypt password:', err);
        return null;
      }
    } else {
      // PBKDF2 password
      if (!verifyPassword(password, user.passwordHash)) return null;
    }

    return {
      id: user.id,
      email: user.email,
      role: user.role
    };
  } catch (err) {
    console.error('Failed to verify login:', err);
    return null;
  }
}

export function cleanExpiredSessions(): void {
  try {
    const now = new Date().toISOString();
    db.delete(sessions).where(gt(now, sessions.expiresAt)).run();
  } catch (err) {
    console.error('Failed to clean expired sessions:', err);
  }
}

export async function createUser(email: string, password: string): Promise<User | null> {
  try {
    // Check if user already exists
    const existing = getUserByEmail(email);
    if (existing) return null;

    // Hash password with bcrypt (same as old backend for consistency)
    const bcrypt = await import('bcrypt');
    const passwordHash = await bcrypt.hash(password, 12);

    const userId = crypto.randomUUID();

    db.insert(users).values({
      id: userId,
      email: email.toLowerCase(),
      passwordHash,
      role: 'user'
    }).run();

    return {
      id: userId,
      email: email.toLowerCase(),
      role: 'user'
    };
  } catch (err) {
    console.error('Failed to create user:', err);
    return null;
  }
}
