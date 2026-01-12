/**
 * Simple in-memory rate limiter for authentication endpoints.
 *
 * Note: This is an in-memory implementation suitable for single-server deployments.
 * For multi-server deployments, consider using Redis or another distributed store.
 */

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

const attempts = new Map<string, RateLimitRecord>();

// Clean up expired entries periodically to prevent memory leaks
const CLEANUP_INTERVAL_MS = 60 * 1000; // 1 minute

setInterval(() => {
  const now = Date.now();
  for (const [key, record] of attempts.entries()) {
    if (now > record.resetAt) {
      attempts.delete(key);
    }
  }
}, CLEANUP_INTERVAL_MS);

/**
 * Check if a request should be rate limited.
 *
 * @param key - Unique identifier for the rate limit (e.g., "login:192.168.1.1")
 * @param maxAttempts - Maximum number of attempts allowed within the window
 * @param windowMs - Time window in milliseconds
 * @returns true if the request is allowed, false if rate limited
 */
export function checkRateLimit(key: string, maxAttempts: number, windowMs: number): boolean {
  const now = Date.now();
  const record = attempts.get(key);

  // First request or window expired - allow and start new window
  if (!record || now > record.resetAt) {
    attempts.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  // Within window and limit reached - deny
  if (record.count >= maxAttempts) {
    return false;
  }

  // Within window and under limit - allow and increment
  record.count++;
  return true;
}

/**
 * Get the time remaining until the rate limit resets.
 *
 * @param key - Unique identifier for the rate limit
 * @returns Time remaining in milliseconds, or 0 if not rate limited
 */
export function getRateLimitResetTime(key: string): number {
  const now = Date.now();
  const record = attempts.get(key);

  if (!record || now > record.resetAt) {
    return 0;
  }

  return record.resetAt - now;
}

// Rate limit configurations
export const RATE_LIMITS = {
  LOGIN: {
    maxAttempts: 5,
    windowMs: 60 * 1000, // 1 minute
    prefix: 'login'
  },
  SIGNUP: {
    maxAttempts: 3,
    windowMs: 60 * 60 * 1000, // 1 hour
    prefix: 'signup'
  }
} as const;

/**
 * Helper to get client IP from request.
 * Handles common proxy headers.
 */
export function getClientIP(request: Request): string {
  // Check common proxy headers
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    // x-forwarded-for can contain multiple IPs, take the first one
    return forwardedFor.split(',')[0].trim();
  }

  const realIP = request.headers.get('x-real-ip');
  if (realIP) {
    return realIP;
  }

  // Fallback for development/local
  return 'unknown';
}
