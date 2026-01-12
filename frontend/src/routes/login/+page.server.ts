import type { Actions } from './$types';
import { fail, redirect } from '@sveltejs/kit';
import { verifyLogin, createSession } from '$lib/server/auth';

export const actions: Actions = {
  default: async ({ request, cookies }) => {
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
