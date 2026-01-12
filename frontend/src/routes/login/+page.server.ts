import type { Actions } from './$types';
import { fail, redirect } from '@sveltejs/kit';
import { verifyLogin, createSession } from '$lib/server/auth';
import { checkRateLimit, getClientIP, getRateLimitResetTime, RATE_LIMITS } from '$lib/server/rate-limit';

export const actions: Actions = {
  default: async ({ request, cookies }) => {
    // Rate limiting: 5 attempts per IP per minute
    const clientIP = getClientIP(request);
    const rateLimitKey = `${RATE_LIMITS.LOGIN.prefix}:${clientIP}`;

    if (!checkRateLimit(rateLimitKey, RATE_LIMITS.LOGIN.maxAttempts, RATE_LIMITS.LOGIN.windowMs)) {
      const resetTime = getRateLimitResetTime(rateLimitKey);
      const secondsRemaining = Math.ceil(resetTime / 1000);
      return fail(429, {
        error: `Too many login attempts. Please try again in ${secondsRemaining} seconds.`,
        email: ''
      });
    }

    const formData = await request.formData();
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;

    if (!email || !password) {
      return fail(400, { error: 'Email and password are required', email });
    }

    const user = await verifyLogin(email, password);

    if (!user) {
      return fail(401, { error: 'Invalid email or password', email });
    }

    const sessionId = createSession(user.id);

    cookies.set('session', sessionId, {
      path: '/',
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30 // 30 days
    });

    throw redirect(303, '/');
  }
};
