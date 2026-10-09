import { fail, redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { hashPassword, verifyPassword } from '#lib/server/auth/password.ts';
import { clearFailures, recordFailure, tooManyFailures } from '#lib/server/auth/rate-limit.ts';
import { createSession, setSessionCookie } from '#lib/server/auth/session.ts';
import { db } from '#lib/server/db/index.ts';
import { users } from '#lib/server/db/schema.ts';
import type { Actions, PageServerLoad } from './$types';

// Verified against when the e-mail is unknown, so timing does not reveal which accounts exist.
let dummyHash: Promise<string> | undefined;
const dummy = () => (dummyHash ??= hashPassword('not-a-real-password'));

const safeNext = (v: FormDataEntryValue | string | null) => {
	const s = String(v ?? '');
	return s.startsWith('/') && !s.startsWith('//') ? s : '/';
};

export const load: PageServerLoad = ({ locals, url }) => {
	if (locals.user) redirect(303, safeNext(url.searchParams.get('next')));
	return { next: safeNext(url.searchParams.get('next')) };
};

export const actions: Actions = {
	default: async ({ request, cookies, getClientAddress }) => {
		const ip = getClientAddress();
		const form = await request.formData();
		const email = String(form.get('email') ?? '').trim().toLowerCase();
		const password = String(form.get('password') ?? '');
		const next = safeNext(form.get('next'));

		if (await tooManyFailures(ip))
			return fail(429, { email, error: 'Příliš mnoho pokusů. Zkuste to za 15 minut.' });

		const [user] = email ? await db.select().from(users).where(eq(users.email, email)) : [];
		const ok = await verifyPassword(user?.passwordHash ?? (await dummy()), password);
		if (!user || !user.passwordHash || !ok || user.disabled) {
			await recordFailure(ip, email);
			return fail(400, { email, error: 'Nesprávný e-mail nebo heslo.' });
		}
		await clearFailures(ip);

		const needsTotp = Boolean(user.totpSecret);
		const { token, expiresAt } = await createSession(user, ip, !needsTotp);
		setSessionCookie(cookies, token, expiresAt);
		if (needsTotp) redirect(303, '/prihlaseni/overeni?next=' + encodeURIComponent(next));
		await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));
		redirect(303, next === '/' ? (user.role === 'admin' ? '/admin' : '/app') : next);
	}
};
