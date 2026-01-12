import type { Actions } from './$types';
import { redirect } from '@sveltejs/kit';
import { deleteSession } from '$lib/server/auth';

export const actions: Actions = {
  default: async ({ cookies }) => {
    const sessionId = cookies.get('session');

    if (sessionId) {
      deleteSession(sessionId);
      cookies.delete('session', { path: '/' });
    }

    throw redirect(303, '/login');
  }
};
