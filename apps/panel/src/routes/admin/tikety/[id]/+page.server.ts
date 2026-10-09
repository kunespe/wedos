import { error, fail } from '@sveltejs/kit';
import { and, asc, eq, isNotNull } from 'drizzle-orm';
import { ORIGIN } from '$app/env/private';
import { audit } from '#lib/server/audit.ts';
import { db } from '#lib/server/db/index.ts';
import { customers, services, ticketMessages, tickets, users } from '#lib/server/db/schema.ts';
import { requireAdmin } from '#lib/server/guards.ts';
import { sendMail } from '#lib/server/mail.ts';
import { TICKET_STATUSES, type TicketStatus } from '#lib/constants.ts';
import type { Actions, PageServerLoad } from './$types';

async function getTicket(id: number) {
	const [t] = await db.select().from(tickets).where(eq(tickets.id, id));
	if (!t) error(404, 'Tiket neexistuje.');
	return t;
}

export const load: PageServerLoad = async (event) => {
	requireAdmin(event);
	const ticket = await getTicket(Number(event.params.id));
	const [[customer], messages, [service]] = await Promise.all([
		db.select().from(customers).where(eq(customers.id, ticket.customerId)),
		db
			.select({ id: ticketMessages.id, body: ticketMessages.body, internal: ticketMessages.internal, createdAt: ticketMessages.createdAt, author: users.name, role: users.role })
			.from(ticketMessages)
			.leftJoin(users, eq(ticketMessages.authorId, users.id))
			.where(eq(ticketMessages.ticketId, ticket.id))
			.orderBy(asc(ticketMessages.createdAt)),
		ticket.serviceId ? db.select({ id: services.id, label: services.label }).from(services).where(eq(services.id, ticket.serviceId)) : [undefined]
	]);
	return { ticket, customer, messages, service };
};

/** Sends a public reply: stores it, e-mails the customer's active logins and sets the ticket status. */
async function replyToCustomer(event: Parameters<Actions[string]>[0], ticket: Awaited<ReturnType<typeof getTicket>>, body: string, status: TicketStatus) {
	await db.insert(ticketMessages).values({ ticketId: ticket.id, authorId: event.locals.user!.id, internal: false, body });
	await db.update(tickets).set({ status }).where(eq(tickets.id, ticket.id));
	const recipients = await db
		.select({ email: users.email })
		.from(users)
		.where(and(eq(users.customerId, ticket.customerId), eq(users.disabled, false), isNotNull(users.passwordHash)));
	await Promise.all(
		recipients.map((r) =>
			sendMail(r.email, `Re: ${ticket.subject} [#${ticket.id}]`, `${body}\n\n${event.locals.user!.name}, SERVEROS\n\nOdpovědět můžete v klientské zóně: ${ORIGIN}/app/podpora/${ticket.id}`)
		)
	);
}

export const actions: Actions = {
	reply: async (event) => {
		requireAdmin(event);
		const ticket = await getTicket(Number(event.params.id));
		const form = await event.request.formData();
		const body = String(form.get('body') ?? '').trim();
		const internal = form.get('internal') === 'on';
		if (!body) return fail(400, { error: 'Zpráva je prázdná.' });
		if (body.length > 8000) return fail(400, { error: 'Zpráva je příliš dlouhá.' });
		if (!internal) {
			await replyToCustomer(event, ticket, body, 'waiting');
		} else {
			await db.insert(ticketMessages).values({ ticketId: ticket.id, authorId: event.locals.user!.id, internal, body });
			await db.update(tickets).set({ updatedAt: new Date() }).where(eq(tickets.id, ticket.id));
		}
		await audit(event, internal ? 'ticket_note' : 'ticket_reply', `tiket ${ticket.id}`);
		return { message: internal ? 'Interní poznámka uložena.' : 'Odpověď odeslána.' };
	},
	// Quick action for structured requests: the work is done, tell the customer and close in one step.
	done: async (event) => {
		requireAdmin(event);
		const ticket = await getTicket(Number(event.params.id));
		const body = String((await event.request.formData()).get('body') ?? '').trim();
		if (!body) return fail(400, { error: 'Napište zákazníkovi krátce, co je hotové.' });
		if (body.length > 8000) return fail(400, { error: 'Zpráva je příliš dlouhá.' });
		await replyToCustomer(event, ticket, body, 'closed');
		await audit(event, 'ticket_done', `tiket ${ticket.id}`);
		return { message: 'Odpověď odeslána a požadavek uzavřen.' };
	},
	status: async (event) => {
		requireAdmin(event);
		const ticket = await getTicket(Number(event.params.id));
		const status = String((await event.request.formData()).get('status')) as TicketStatus;
		if (!TICKET_STATUSES.includes(status)) return fail(400, { error: 'Neplatný stav.' });
		await db.update(tickets).set({ status }).where(eq(tickets.id, ticket.id));
		await audit(event, 'ticket_status', `tiket ${ticket.id}`, status);
		return { message: 'Stav změněn.' };
	}
};
