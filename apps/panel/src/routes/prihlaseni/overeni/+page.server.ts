import { fail, redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { recordFailure, tooManyFailures } from '#lib/server/auth/rate-limit.ts';
import { markVerified, SESSION_COOKIE, validateSession } from '#lib/server/auth/session.ts';
import { verifyTotp } from '#lib/server/auth/totp.ts';
import { db } from '#lib/server/db/index.ts';
import { users } from '#lib/server/db/schema.ts';
import type { Actions, PageServerLoad } from './$types';

async function pending(cookies: import('@sveltejs/kit').Cookies) {
	const token = cookies.get(SESSION_COOKIE);
	const found = token ? await validateSession(token) : null;
	if (!token || !found) redirect(303, '/prihlaseni');
	if (found.session.verified) redirect(303, '/');
	return { token, user: found.user };
}

export const load: PageServerLoad = async ({ cookies }) => {
	await pending(cookies);
	return {};
};

export const actions: Actions = {
	default: async ({ request, cookies, getClientAddress, url }) => {
		const ip = getClientAddress();
		const { token, user } = await pending(cookies);
		if (await tooManyFailures(ip)) return fail(429, { error: 'Příliš mnoho pokusů. Zkuste to za 15 minut.' });
		const code = String((await request.formData()).get('code') ?? '').replace(/\s/g, '');
		if (!user.totpSecret || !verifyTotp(user.totpSecret, code)) {
			await recordFailure(ip, user.email);
			return fail(400, { error: 'Kód nesouhlasí. Zkuste aktuální kód z aplikace.' });
		}
		await markVerified(token);
		await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));
		const next = url.searchParams.get('next') ?? '/';
		redirect(303, next.startsWith('/') && !next.startsWith('//') ? next : '/');
	}
};
