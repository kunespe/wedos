import { error, fail, redirect } from '@sveltejs/kit';
import { and, eq, gt, isNull } from 'drizzle-orm';
import { hashPassword, passwordProblem } from '#lib/server/auth/password.ts';
import { createSession, invalidateUserSessions, setSessionCookie } from '#lib/server/auth/session.ts';
import { hashToken } from '#lib/server/auth/tokens.ts';
import { db } from '#lib/server/db/index.ts';
import { invites, users } from '#lib/server/db/schema.ts';
import type { Actions, PageServerLoad } from './$types';

async function findInvite(token: string) {
	const [row] = await db
		.select({ invite: invites, user: users })
		.from(invites)
		.innerJoin(users, eq(invites.userId, users.id))
		.where(and(eq(invites.id, hashToken(token)), gt(invites.expiresAt, new Date()), isNull(invites.usedAt)));
	return row;
}

export const load: PageServerLoad = async ({ params }) => {
	const row = await findInvite(params.token);
	if (!row || row.user.disabled) error(410, 'Odkaz už neplatí. Požádejte nás o nový na info@servero.cz.');
	return { email: row.user.email, name: row.user.name, purpose: row.invite.purpose };
};

export const actions: Actions = {
	default: async ({ params, request, cookies, getClientAddress }) => {
		const row = await findInvite(params.token);
		if (!row || row.user.disabled) error(410, 'Odkaz už neplatí.');
		const form = await request.formData();
		const password = String(form.get('password') ?? '');
		const problem = passwordProblem(password);
		if (problem) return fail(400, { error: problem });
		if (password !== String(form.get('confirm') ?? '')) return fail(400, { error: 'Hesla se neshodují.' });

		await db.update(users).set({ passwordHash: await hashPassword(password) }).where(eq(users.id, row.user.id));
		await db.update(invites).set({ usedAt: new Date() }).where(eq(invites.id, row.invite.id));
		// A reset link means the old password may be known to someone else.
		await invalidateUserSessions(row.user.id);

		const needsTotp = Boolean(row.user.totpSecret);
		const { token, expiresAt } = await createSession(row.user, getClientAddress(), !needsTotp);
		setSessionCookie(cookies, token, expiresAt);
		redirect(303, needsTotp ? '/prihlaseni/overeni' : row.user.role === 'admin' ? '/nastaveni-2fa' : '/app');
	}
};
