import type { Actions } from './$types';
import { fail, redirect } from '@sveltejs/kit';
import { createUser, createSession } from '$lib/server/auth';
import { checkRateLimit, getClientIP, getRateLimitResetTime, RATE_LIMITS } from '$lib/server/rate-limit';

export const actions: Actions = {
  default: async ({ request, cookies }) => {
    // Rate limiting: 3 signups per IP per hour
    const clientIP = getClientIP(request);
    const rateLimitKey = `${RATE_LIMITS.SIGNUP.prefix}:${clientIP}`;

    if (!checkRateLimit(rateLimitKey, RATE_LIMITS.SIGNUP.maxAttempts, RATE_LIMITS.SIGNUP.windowMs)) {
      const resetTime = getRateLimitResetTime(rateLimitKey);
      const minutesRemaining = Math.ceil(resetTime / (60 * 1000));
      return fail(429, {
        error: `Too many signup attempts. Please try again in ${minutesRemaining} minute${minutesRemaining === 1 ? '' : 's'}.`,
        email: ''
      });
    }

    const formData = await request.formData();
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    const confirmPassword = formData.get('confirmPassword') as string;

    if (!email || !password || !confirmPassword) {
      return fail(400, { error: 'All fields are required', email });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return fail(400, { error: 'Please enter a valid email address', email });
    }

    // Validate password length
    if (password.length < 8) {
      return fail(400, { error: 'Password must be at least 8 characters', email });
    }

    // Check passwords match
    if (password !== confirmPassword) {
      return fail(400, { error: 'Passwords do not match', email });
    }

    const user = await createUser(email, password);

    if (!user) {
      return fail(400, { error: 'An account with this email already exists', email });
    }

    // Auto-login after signup
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
