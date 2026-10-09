import { fail, redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import QRCode from 'qrcode';
import { newTotpSecret, totpUri, verifyTotp } from '#lib/server/auth/totp.ts';
import { db } from '#lib/server/db/index.ts';
import { users } from '#lib/server/db/schema.ts';
import type { Actions, PageServerLoad } from './$types';

// The candidate secret lives in a short-lived cookie until the first code proves the app has it.
const COOKIE = 'servero_totp_setup';

export const load: PageServerLoad = async ({ locals, cookies }) => {
	const user = locals.user;
	if (!user) redirect(303, '/prihlaseni');
	if (user.hasTotp) redirect(303, user.role === 'admin' ? '/admin' : '/app/ucet');
	let secret = cookies.get(COOKIE);
	if (!secret) {
		secret = newTotpSecret();
		cookies.set(COOKIE, secret, { path: '/nastaveni-2fa', httpOnly: true, sameSite: 'strict', maxAge: 900 });
	}
	const uri = totpUri(secret, user.email);
	return { qr: await QRCode.toString(uri, { type: 'svg', margin: 0 }), uri, required: user.role === 'admin' };
};

export const actions: Actions = {
	default: async ({ locals, cookies, request }) => {
		const user = locals.user;
		if (!user) redirect(303, '/prihlaseni');
		const secret = cookies.get(COOKIE);
		if (!secret) return fail(400, { error: 'Nastavení vypršelo, načtěte stránku znovu.' });
		const code = String((await request.formData()).get('code') ?? '').replace(/\s/g, '');
		if (!verifyTotp(secret, code)) return fail(400, { error: 'Kód nesouhlasí. Zkontrolujte čas v telefonu.' });
		await db.update(users).set({ totpSecret: secret }).where(eq(users.id, user.id));
		cookies.delete(COOKIE, { path: '/nastaveni-2fa' });
		redirect(303, user.role === 'admin' ? '/admin' : '/app/ucet');
	}
};
