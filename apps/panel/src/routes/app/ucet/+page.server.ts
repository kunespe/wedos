import { error, fail } from '@sveltejs/kit';
import { and, asc, eq, gt, ne, sql } from 'drizzle-orm';
import { audit } from '#lib/server/audit.ts';
import { hashPassword, passwordProblem, verifyPassword } from '#lib/server/auth/password.ts';
import { hashToken } from '#lib/server/auth/tokens.ts';
import { verifyTotp } from '#lib/server/auth/totp.ts';
import { LIMITS } from '#lib/server/client-area.ts';
import { requireClient } from '#lib/server/guards.ts';
import { db } from '#lib/server/db/index.ts';
import { sessions, users } from '#lib/server/db/schema.ts';
import type { Actions, PageServerLoad } from './$types';

async function me(id: number) {
	const [row] = await db
		.select({ id: users.id, passwordHash: users.passwordHash, totpSecret: users.totpSecret })
		.from(users)
		.where(eq(users.id, id));
	if (!row) error(404, 'Účet nenalezen.');
	return row;
}

export const load: PageServerLoad = async (event) => {
	const user = requireClient(event);
	const [colleagues, [sessionCount]] = await Promise.all([
		db
			.select({
				id: users.id,
				name: users.name,
				email: users.email,
				lastLoginAt: users.lastLoginAt,
				activated: sql<number>`${users.passwordHash} is not null`,
				hasTotp: sql<number>`${users.totpSecret} is not null`,
				disabled: users.disabled
			})
			.from(users)
			.where(and(eq(users.customerId, user.customerId), eq(users.role, 'client')))
			.orderBy(asc(users.name)),
		db.select({ n: sql<number>`count(*)` }).from(sessions).where(and(eq(sessions.userId, user.id), gt(sessions.expiresAt, new Date())))
	]);
	return {
		me: { id: user.id, name: user.name, email: user.email, hasTotp: user.hasTotp },
		colleagues: colleagues.map((c) => ({ ...c, activated: Boolean(Number(c.activated)), hasTotp: Boolean(Number(c.hasTotp)) })),
		sessions: Number(sessionCount.n),
		limits: LIMITS
	};
};

export const actions: Actions = {
	name: async (event) => {
		const user = requireClient(event);
		const name = String((await event.request.formData()).get('name') ?? '').trim();
		if (!name) return fail(400, { action: 'name', error: 'Jméno nesmí být prázdné.' });
		if (name.length > LIMITS.name) return fail(400, { action: 'name', error: `Jméno může mít nejvýš ${LIMITS.name} znaků.` });
		await db.update(users).set({ name }).where(eq(users.id, user.id));
		await audit(event, 'account_name', `user ${user.id}`);
		return { action: 'name', message: 'Jméno uloženo.' };
	},

	password: async (event) => {
		const user = requireClient(event);
		const form = await event.request.formData();
		const current = String(form.get('current') ?? '');
		const next = String(form.get('next') ?? '');
		const confirm = String(form.get('confirm') ?? '');
		const row = await me(user.id);
		if (!row.passwordHash || !(await verifyPassword(row.passwordHash, current)))
			return fail(400, { action: 'password', error: 'Současné heslo nesouhlasí.' });
		const problem = passwordProblem(next);
		if (problem) return fail(400, { action: 'password', error: problem });
		if (next !== confirm) return fail(400, { action: 'password', error: 'Nová hesla se neshodují.' });
		if (next === current) return fail(400, { action: 'password', error: 'Nové heslo je stejné jako současné.' });
		await db.update(users).set({ passwordHash: await hashPassword(next) }).where(eq(users.id, user.id));
		// Keep this browser signed in, sign out everywhere else.
		const keep = event.locals.sessionToken ? hashToken(event.locals.sessionToken) : '';
		await db.delete(sessions).where(and(eq(sessions.userId, user.id), ne(sessions.id, keep)));
		await audit(event, 'account_password', `user ${user.id}`);
		return { action: 'password', message: 'Heslo změněno. Ostatní přihlášená zařízení jsme odhlásili.' };
	},

	disable2fa: async (event) => {
		const user = requireClient(event);
		const code = String((await event.request.formData()).get('code') ?? '').replace(/\s/g, '');
		const row = await me(user.id);
		if (!row.totpSecret) return { action: '2fa', message: 'Dvoufázové ověření už je vypnuté.' };
		if (!verifyTotp(row.totpSecret, code)) return fail(400, { action: '2fa', error: 'Kód nesouhlasí. Zkontrolujte čas v telefonu.' });
		await db.update(users).set({ totpSecret: null }).where(eq(users.id, user.id));
		await audit(event, 'account_2fa_off', `user ${user.id}`);
		return { action: '2fa', message: 'Dvoufázové ověření je vypnuté.' };
	}
};
