import { fail } from '@sveltejs/kit';
import { and, asc, eq, gt, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { ORIGIN } from '$app/env/private';
import { audit } from '#lib/server/audit.ts';
import { createInvite, inviteUrl } from '#lib/server/auth/invites.ts';
import { invalidateUserSessions } from '#lib/server/auth/session.ts';
import { db } from '#lib/server/db/index.ts';
import { invites, users } from '#lib/server/db/schema.ts';
import { requireAdmin } from '#lib/server/guards.ts';
import { sendMail } from '#lib/server/mail.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const me = requireAdmin(event);
	const [admins, open] = await Promise.all([
		db
			.select({
				id: users.id,
				name: users.name,
				email: users.email,
				totpSecret: users.totpSecret,
				passwordHash: users.passwordHash,
				disabled: users.disabled,
				lastLoginAt: users.lastLoginAt,
				createdAt: users.createdAt
			})
			.from(users)
			.where(eq(users.role, 'admin'))
			.orderBy(asc(users.name)),
		db
			.select({ userId: invites.userId, purpose: invites.purpose, expiresAt: invites.expiresAt })
			.from(invites)
			.where(and(isNull(invites.usedAt), gt(invites.expiresAt, new Date())))
	]);
	// Never send hashes or secrets to the browser; only whether they are set.
	return {
		meId: me.id,
		admins: admins.map(({ totpSecret, passwordHash, ...a }) => ({
			...a,
			hasTotp: totpSecret != null,
			hasPassword: passwordHash != null,
			invite: open.find((i) => i.userId === a.id) ?? null
		}))
	};
};

const inviteSchema = z.object({
	name: z.string().trim().min(2, 'Vyplňte jméno.').max(160),
	email: z.string().trim().toLowerCase().pipe(z.email('Zadejte platný e-mail.')).pipe(z.string().max(254))
});

async function targetAdmin(id: number) {
	const [row] = await db.select().from(users).where(and(eq(users.id, id), eq(users.role, 'admin')));
	return row;
}

async function deliver(email: string, name: string, link: string, purpose: 'invite' | 'reset') {
	return sendMail(
		email,
		purpose === 'invite' ? 'SERVEROS: pozvánka do administrace' : 'SERVEROS: nové heslo do administrace',
		purpose === 'invite'
			? `Dobrý den, ${name},\n\nmáte přístup do administrace SERVEROS. Heslo si nastavíte tady (odkaz platí 7 dní):\n\n${link}\n\nPo nastavení hesla si zapnete dvoufázové ověření.\n\nTým SERVEROS`
			: `Dobrý den, ${name},\n\nnové heslo do administrace SERVEROS si nastavíte tady (odkaz platí 24 hodin):\n\n${link}\n\nPokud jste o změnu nežádali, ozvěte se kolegům.\n\nTým SERVEROS`
	);
}

export const actions: Actions = {
	invite: async (event) => {
		requireAdmin(event);
		const form = await event.request.formData();
		const values = { name: String(form.get('name') ?? ''), email: String(form.get('email') ?? '') };
		const parsed = inviteSchema.safeParse(values);
		if (!parsed.success) return fail(400, { error: parsed.error.issues[0].message, values });
		const { name, email } = parsed.data;
		const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
		if (existing) return fail(400, { error: 'Účet s tímto e-mailem už existuje.', values });
		const [{ id }] = await db.insert(users).values({ email, name, role: 'admin' }).$returningId();
		const link = inviteUrl(ORIGIN, await createInvite(db, id, 'invite'));
		const mailed = form.get('send') === 'on' ? await deliver(email, name, link, 'invite') : false;
		await audit(event, 'admin_invite', email, mailed ? 'odesláno e-mailem' : 'odkaz předán ručně');
		return { message: `Správce ${name} založen.`, link: { url: link, email, mailed, purpose: 'invite' as const } };
	},
	toggle: async (event) => {
		const me = requireAdmin(event);
		const id = Number((await event.request.formData()).get('id'));
		if (id === me.id) return fail(400, { error: 'Sami sebe zablokovat nemůžete.' });
		const target = await targetAdmin(id);
		if (!target) return fail(400, { error: 'Správce neexistuje.' });
		const disabled = !target.disabled;
		await db.update(users).set({ disabled }).where(eq(users.id, id));
		if (disabled) await invalidateUserSessions(id);
		await audit(event, disabled ? 'admin_disable' : 'admin_enable', target.email);
		return { message: disabled ? `${target.name} je zablokovaný a byl odhlášen.` : `${target.name} má znovu přístup.` };
	},
	reset2fa: async (event) => {
		const me = requireAdmin(event);
		const id = Number((await event.request.formData()).get('id'));
		if (id === me.id) return fail(400, { error: 'Vlastní dvoufázové ověření tady resetovat nejde; požádejte kolegu.' });
		const target = await targetAdmin(id);
		if (!target) return fail(400, { error: 'Správce neexistuje.' });
		await db.update(users).set({ totpSecret: null }).where(eq(users.id, id));
		// Existing sessions must not be able to enrol a new factor without a fresh password login.
		await invalidateUserSessions(id);
		await audit(event, 'admin_reset_2fa', target.email);
		return { message: `Dvoufázové ověření pro ${target.name} je zrušené. Po dalším přihlášení si ho musí nastavit znovu.` };
	},
	resetPassword: async (event) => {
		requireAdmin(event);
		const form = await event.request.formData();
		const target = await targetAdmin(Number(form.get('id')));
		if (!target) return fail(400, { error: 'Správce neexistuje.' });
		if (target.disabled) return fail(400, { error: 'Zablokovaný správce odkaz nepoužije. Nejdřív ho odblokujte.' });
		const purpose = target.passwordHash ? 'reset' : 'invite';
		const link = inviteUrl(ORIGIN, await createInvite(db, target.id, purpose));
		const mailed = form.get('send') === 'on' ? await deliver(target.email, target.name, link, purpose) : false;
		await audit(event, 'admin_password_link', target.email, mailed ? 'odesláno e-mailem' : 'odkaz předán ručně');
		return { message: `Nový odkaz pro ${target.name} je připravený.`, link: { url: link, email: target.email, mailed, purpose } };
	}
};
