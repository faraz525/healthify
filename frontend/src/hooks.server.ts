import type { Handle } from '@sveltejs/kit';
import { redirect } from '@sveltejs/kit';
import { validateSession, cleanExpiredSessions } from '$lib/server/auth';

const PUBLIC_PATHS = ['/login', '/signup'];

// Periodically clean expired sessions (every ~100 requests)
let requestCount = 0;
const CLEANUP_INTERVAL = 100;

export const handle: Handle = async ({ event, resolve }) => {
  // Periodic session cleanup
  requestCount++;
  if (requestCount >= CLEANUP_INTERVAL) {
    requestCount = 0;
    // Run cleanup asynchronously to not block the request
    cleanExpiredSessions();
  }

  const sessionId = event.cookies.get('session');

  if (sessionId) {
    const user = validateSession(sessionId);
    if (user) {
      event.locals.user = user;
    } else {
      // Invalid or expired session - clear cookie
      event.cookies.delete('session', { path: '/' });
    }
  }

  // Protect routes - redirect to login if not authenticated
  const isPublicPath = PUBLIC_PATHS.some(path => event.url.pathname.startsWith(path));

  if (!event.locals.user && !isPublicPath) {
    throw redirect(303, '/login');
  }

  // Redirect logged-in users away from auth pages
  if (event.locals.user && (event.url.pathname === '/login' || event.url.pathname === '/signup')) {
    throw redirect(303, '/');
  }

  return resolve(event);
};
