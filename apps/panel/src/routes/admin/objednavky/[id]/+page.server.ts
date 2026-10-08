import { error, fail } from '@sveltejs/kit';
import { asc, eq } from 'drizzle-orm';
import { ORIGIN } from '$app/env/private';
import { inviteUrl } from '#lib/server/auth/invites.ts';
import { audit } from '#lib/server/audit.ts';
import { db } from '#lib/server/db/index.ts';
import { customers, nodes, orderNotes, orders, plans, services, users } from '#lib/server/db/schema.ts';
import { convertOrder, FulfilmentError } from '#lib/server/fulfilment.ts';
import { sendMail } from '#lib/server/mail.ts';
import { ORDER_STATUSES, type OrderStatus } from '#lib/constants.ts';
import { canTransition, ORDER_STATUS_LABEL } from '#lib/orders.ts';
import type { Actions, PageServerLoad } from './$types';

async function getOrder(id: number) {
	const [row] = await db.select().from(orders).where(eq(orders.id, id));
	if (!row) error(404, 'Objednávka neexistuje.');
	return row;
}

export const load: PageServerLoad = async ({ params }) => {
	const order = await getOrder(Number(params.id));
	const [[plan], notes, admins, nodeRows, linked, customer] = await Promise.all([
		db.select().from(plans).where(eq(plans.code, order.planCode)),
		db
			.select({ id: orderNotes.id, body: orderNotes.body, createdAt: orderNotes.createdAt, author: users.name })
			.from(orderNotes)
			.leftJoin(users, eq(orderNotes.authorId, users.id))
			.where(eq(orderNotes.orderId, order.id))
			.orderBy(asc(orderNotes.createdAt)),
		db.select({ id: users.id, name: users.name }).from(users).where(eq(users.role, 'admin')),
		db.select({ id: nodes.id, name: nodes.name, host: nodes.host }).from(nodes),
		db.select({ id: services.id, label: services.label, status: services.status }).from(services).where(eq(services.orderId, order.id)),
		order.customerId ? db.select().from(customers).where(eq(customers.id, order.customerId)).then((r) => r[0]) : null
	]);
	return { order, plan, notes, admins, nodes: nodeRows, linked, customer };
};

export const actions: Actions = {
	status: async (event) => {
		const order = await getOrder(Number(event.params.id));
		const to = String((await event.request.formData()).get('status')) as OrderStatus;
		if (!ORDER_STATUSES.includes(to) || !canTransition(order.status, to))
			return fail(400, { error: `Z „${ORDER_STATUS_LABEL[order.status]}“ nejde přejít na „${ORDER_STATUS_LABEL[to] ?? to}“.` });
		await db.update(orders).set({ status: to }).where(eq(orders.id, order.id));
		await db.insert(orderNotes).values({
			orderId: order.id,
			authorId: event.locals.user!.id,
			body: `Stav: ${ORDER_STATUS_LABEL[order.status]} → ${ORDER_STATUS_LABEL[to]}`
		});
		await audit(event, 'order_status', `#${order.id}`, `${order.status} → ${to}`);
		return { message: `Stav změněn na „${ORDER_STATUS_LABEL[to]}“.` };
	},
	assign: async (event) => {
		const order = await getOrder(Number(event.params.id));
		const raw = String((await event.request.formData()).get('assignee') ?? '');
		const assigneeId = raw ? Number(raw) : null;
		await db.update(orders).set({ assigneeId }).where(eq(orders.id, order.id));
		await audit(event, 'order_assign', `#${order.id}`, String(assigneeId ?? 'nikdo'));
		return { message: 'Řešitel uložen.' };
	},
	note: async (event) => {
		const order = await getOrder(Number(event.params.id));
		const body = String((await event.request.formData()).get('body') ?? '').trim();
		if (!body) return fail(400, { error: 'Poznámka je prázdná.' });
		if (body.length > 4000) return fail(400, { error: 'Poznámka je příliš dlouhá.' });
		await db.insert(orderNotes).values({ orderId: order.id, authorId: event.locals.user!.id, body });
		return { message: 'Poznámka přidána.' };
	},
	convert: async (event) => {
		const order = await getOrder(Number(event.params.id));
		const form = await event.request.formData();
		const nodeId = form.get('node') ? Number(form.get('node')) : null;
		const send = form.get('send') === 'on';
		try {
			const result = await convertOrder(db, order.id, nodeId);
			await audit(event, 'order_convert', `#${order.id}`, `zákazník ${result.customerId}, služba ${result.serviceId}`);
			const link = result.inviteToken ? inviteUrl(ORIGIN, result.inviteToken) : null;
			let mailed = false;
			if (link && send) {
				mailed = await sendMail(
					order.email,
					'SERVERO: přístup do klientské zóny',
					`Dobrý den,\n\nzakládáme vaši službu. V klientské zóně uvidíte její stav, faktury a podporu.\nHeslo si nastavíte tady (odkaz platí 7 dní):\n\n${link}\n\nTým SERVERO`
				);
			}
			return {
				message: result.createdCustomer ? 'Zákazník a služba založeni.' : 'Služba přidána k existujícímu zákazníkovi.',
				invite: link,
				mailed,
				serviceId: result.serviceId
			};
		} catch (e) {
			if (e instanceof FulfilmentError) return fail(400, { error: e.message });
			throw e;
		}
	}
};
