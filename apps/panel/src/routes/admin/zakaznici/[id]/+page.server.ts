import { error, fail, redirect } from '@sveltejs/kit';
import { and, asc, desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { ORIGIN } from '$app/env/private';
import { createInvite, inviteUrl } from '#lib/server/auth/invites.ts';
import { invalidateUserSessions } from '#lib/server/auth/session.ts';
import { audit } from '#lib/server/audit.ts';
import { activePlans } from '#lib/server/catalog.ts';
import { db } from '#lib/server/db/index.ts';
import { customers, domains, nodes, paymentRequests, services, tickets, users } from '#lib/server/db/schema.ts';
import { customerSchema, optionalDate, parseForm } from '#lib/server/forms.ts';
import { requireAdmin } from '#lib/server/guards.ts';
import { sendMail } from '#lib/server/mail.ts';
import { paymentRows } from '#lib/server/payment-ops.ts';
import { createPaymentRequest, PaymentError } from '#lib/server/payments.ts';
import type { Actions, PageServerLoad } from './$types';

async function getCustomer(id: number) {
	const [c] = await db.select().from(customers).where(eq(customers.id, id));
	if (!c) error(404, 'Zákazník neexistuje.');
	return c;
}

export const load: PageServerLoad = async (event) => {
	requireAdmin(event);
	const customer = await getCustomer(Number(event.params.id));
	const [userRows, serviceRows, domainRows, ticketRows, plans, nodeRows, paymentList] = await Promise.all([
		db
			.select({ id: users.id, name: users.name, email: users.email, passwordHash: users.passwordHash, totp: users.totpSecret, disabled: users.disabled, lastLoginAt: users.lastLoginAt })
			.from(users)
			.where(eq(users.customerId, customer.id))
			.orderBy(asc(users.id)),
		db.select().from(services).where(eq(services.customerId, customer.id)).orderBy(desc(services.createdAt)),
		db.select().from(domains).where(eq(domains.customerId, customer.id)).orderBy(asc(domains.name)),
		db.select().from(tickets).where(eq(tickets.customerId, customer.id)).orderBy(desc(tickets.updatedAt)).limit(10),
		activePlans(),
		db.select({ id: nodes.id, name: nodes.name }).from(nodes),
		paymentRows(eq(paymentRequests.customerId, customer.id)).limit(30)
	]);
	return {
		customer,
		users: userRows.map(({ passwordHash, totp, ...u }) => ({ ...u, activated: Boolean(passwordHash), hasTotp: Boolean(totp) })),
		services: serviceRows,
		domains: domainRows,
		tickets: ticketRows,
		plans,
		nodes: nodeRows,
		payments: paymentList
	};
};

async function ownUser(customerId: number, userId: number) {
	const [u] = await db.select().from(users).where(and(eq(users.id, userId), eq(users.customerId, customerId)));
	if (!u) error(404, 'Uživatel nepatří tomuto zákazníkovi.');
	return u;
}

export const actions: Actions = {
	update: async (event) => {
		requireAdmin(event);
		const customer = await getCustomer(Number(event.params.id));
		const { data, errors } = parseForm(customerSchema, await event.request.formData());
		if (!data) return fail(400, { errors });
		await db.update(customers).set({ ...data, note: data.note || null }).where(eq(customers.id, customer.id));
		await audit(event, 'customer_update', `zákazník ${customer.id}`);
		return { message: 'Údaje uloženy.' };
	},
	addUser: async (event) => {
		requireAdmin(event);
		const customer = await getCustomer(Number(event.params.id));
		const form = await event.request.formData();
		const parsed = z
			.object({ name: z.string().trim().min(2).max(160), email: z.string().trim().toLowerCase().pipe(z.email()) })
			.safeParse({ name: form.get('name'), email: form.get('email') });
		if (!parsed.success) return fail(400, { error: 'Vyplňte jméno a platný e-mail.' });
		const [exists] = await db.select({ id: users.id }).from(users).where(eq(users.email, parsed.data.email));
		if (exists) return fail(400, { error: 'Tento e-mail už má účet.' });
		const [{ id }] = await db.insert(users).values({ ...parsed.data, role: 'client', customerId: customer.id }).$returningId();
		const link = inviteUrl(ORIGIN, await createInvite(db, id, 'invite'));
		await audit(event, 'user_invite', parsed.data.email, `zákazník ${customer.id}`);
		return { message: 'Uživatel přidán. Pošlete mu pozvánku.', invite: link, inviteFor: parsed.data.email };
	},
	invite: async (event) => {
		requireAdmin(event);
		const customer = await getCustomer(Number(event.params.id));
		const form = await event.request.formData();
		const user = await ownUser(customer.id, Number(form.get('user')));
		const link = inviteUrl(ORIGIN, await createInvite(db, user.id, user.passwordHash ? 'reset' : 'invite'));
		let mailed = false;
		if (form.get('send') === '1')
			mailed = await sendMail(
				user.email,
				user.passwordHash ? 'SERVERO: nastavení nového hesla' : 'SERVERO: přístup do klientské zóny',
				`Dobrý den,\n\n${user.passwordHash ? 'nové heslo si nastavíte' : 'heslo do klientské zóny si nastavíte'} na tomto odkazu (platí ${user.passwordHash ? '24 hodin' : '7 dní'}):\n\n${link}\n\nTým SERVERO`
			);
		await audit(event, user.passwordHash ? 'user_reset' : 'user_invite', user.email);
		return { message: mailed ? 'Odkaz odeslán e-mailem.' : 'Odkaz vygenerován.', invite: link, inviteFor: user.email };
	},
	toggleUser: async (event) => {
		requireAdmin(event);
		const customer = await getCustomer(Number(event.params.id));
		const user = await ownUser(customer.id, Number((await event.request.formData()).get('user')));
		await db.update(users).set({ disabled: !user.disabled }).where(eq(users.id, user.id));
		if (!user.disabled) await invalidateUserSessions(user.id);
		await audit(event, user.disabled ? 'user_enable' : 'user_disable', user.email);
		return { message: user.disabled ? 'Účet povolen.' : 'Účet zablokován a odhlášen.' };
	},
	addService: async (event) => {
		requireAdmin(event);
		const customer = await getCustomer(Number(event.params.id));
		const form = await event.request.formData();
		const plans = await activePlans();
		const plan = plans.find((p) => p.code === form.get('plan'));
		if (!plan) return fail(400, { error: 'Vyberte tarif.' });
		const domain = String(form.get('domain') ?? '').trim().toLowerCase();
		const [{ id }] = await db
			.insert(services)
			.values({
				customerId: customer.id,
				planCode: plan.code,
				kind: plan.kind,
				label: `${plan.name}${domain ? ` · ${domain}` : ''}`,
				domain,
				nodeId: form.get('node') ? Number(form.get('node')) : null,
				status: 'pending',
				period: form.get('period') === 'month' ? 'month' : 'year',
				priceMonthly: plan.monthly
			})
			.$returningId();
		await audit(event, 'service_create', `služba ${id}`, plan.code);
		redirect(303, `/admin/sluzby/${id}`);
	},
	addPayment: async (event) => {
		const admin = requireAdmin(event);
		const customer = await getCustomer(Number(event.params.id));
		const parsed = z
			.object({
				description: z.string().trim().min(3, 'Popište, za co výzva je.').max(200),
				net: z.coerce.number().int('Částka v celých korunách.').positive('Částka musí být kladná.').max(10_000_000),
				serviceId: z.preprocess((v) => (v === '' || v == null ? null : Number(v)), z.number().int().positive().nullable())
			})
			.safeParse(Object.fromEntries(await event.request.formData()));
		if (!parsed.success) return fail(400, { error: parsed.error.issues[0]?.message ?? 'Zkontrolujte výzvu.' });
		const { serviceId } = parsed.data;
		if (serviceId) {
			const [own] = await db.select({ id: services.id }).from(services).where(and(eq(services.id, serviceId), eq(services.customerId, customer.id)));
			if (!own) return fail(400, { error: 'Služba nepatří tomuto zákazníkovi.' });
		}
		try {
			const { id, vs } = await createPaymentRequest(db, { customerId: customer.id, serviceId, description: parsed.data.description, net: parsed.data.net, createdById: admin.id });
			await audit(event, 'payment_create', `výzva ${vs}`, `zákazník ${customer.id}${serviceId ? `, služba ${serviceId}` : ''}`);
			return { message: `Výzva ${vs} vystavena.`, paymentId: id };
		} catch (e) {
			if (e instanceof PaymentError) return fail(400, { error: e.message });
			throw e;
		}
	},
	addDomain: async (event) => {
		requireAdmin(event);
		const customer = await getCustomer(Number(event.params.id));
		const form = await event.request.formData();
		const name = String(form.get('name') ?? '').trim().toLowerCase();
		if (!/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/.test(name)) return fail(400, { error: 'Neplatná doména.' });
		const exp = optionalDate.safeParse(String(form.get('expiresAt') ?? ''));
		if (!exp.success) return fail(400, { error: 'Neplatné datum expirace.' });
		const [dup] = await db.select({ id: domains.id }).from(domains).where(eq(domains.name, name));
		if (dup) return fail(400, { error: 'Doména už je v evidenci.' });
		await db.insert(domains).values({ customerId: customer.id, name, managedByUs: form.get('managedByUs') === 'on', expiresAt: exp.data, registrar: String(form.get('registrar') || 'Subreg').slice(0, 60) });
		await audit(event, 'domain_create', name, `zákazník ${customer.id}`);
		return { message: 'Doména přidána.' };
	}
};
