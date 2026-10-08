import { redirect } from '@sveltejs/kit';
import { clearSessionCookie, invalidateSession, SESSION_COOKIE } from '#lib/server/auth/session.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = () => redirect(303, '/prihlaseni');

export const actions: Actions = {
	default: async ({ cookies }) => {
		const token = cookies.get(SESSION_COOKIE);
		if (token) await invalidateSession(token);
		clearSessionCookie(cookies);
		redirect(303, '/prihlaseni');
	}
};
