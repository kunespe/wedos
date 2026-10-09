import { fail } from '@sveltejs/kit';
import { and, asc, eq, sql } from 'drizzle-orm';
import { audit } from '#lib/server/audit.ts';
import { LIMITS, notifyTeam, ownTicket, routeId } from '#lib/server/client-area.ts';
import { requireClient } from '#lib/server/guards.ts';
import { db } from '#lib/server/db/index.ts';
import { services, ticketMessages, tickets, users } from '#lib/server/db/schema.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const user = requireClient(event);
	const ticket = await ownTicket(user.customerId, routeId(event.params.id));
	const [messages, service] = await Promise.all([
		db
			.select({
				id: ticketMessages.id,
				body: ticketMessages.body,
				createdAt: ticketMessages.createdAt,
				authorName: users.name,
				authorRole: users.role,
				mine: sql<number | null>`${ticketMessages.authorId} = ${user.id}`
			})
			.from(ticketMessages)
			.leftJoin(users, eq(ticketMessages.authorId, users.id))
			// Internal notes are for admins only; never select them for a client.
			.where(and(eq(ticketMessages.ticketId, ticket.id), eq(ticketMessages.internal, false)))
			.orderBy(asc(ticketMessages.createdAt), asc(ticketMessages.id)),
		ticket.serviceId
			? db
					.select({ id: services.id, label: services.label })
					.from(services)
					.where(and(eq(services.id, ticket.serviceId), eq(services.customerId, user.customerId)))
					.then((r) => r[0] ?? null)
			: null
	]);
	return {
		ticket: {
			id: ticket.id,
			subject: ticket.subject,
			status: ticket.status,
			category: ticket.category,
			details: ticket.details,
			createdAt: ticket.createdAt,
			updatedAt: ticket.updatedAt
		},
		messages: messages.map((m) => ({ ...m, mine: Boolean(m.mine) })),
		service,
		created: event.url.searchParams.has('nove'),
		limits: LIMITS
	};
};

export const actions: Actions = {
	reply: async (event) => {
		const user = requireClient(event);
		const ticket = await ownTicket(user.customerId, routeId(event.params.id));
		const body = String((await event.request.formData()).get('body') ?? '').trim();
		if (!body) return fail(400, { body, error: 'Zpráva je prázdná.' });
		if (body.length > LIMITS.body) return fail(400, { body, error: `Zpráva může mít nejvýš ${LIMITS.body} znaků.` });
		await db.transaction(async (tx) => {
			await tx.insert(ticketMessages).values({ ticketId: ticket.id, authorId: user.id, body });
			await tx.update(tickets).set({ status: 'open' }).where(eq(tickets.id, ticket.id));
		});
		await notifyTeam(
			ticket.id,
			`SERVEROS: odpověď v požadavku #${ticket.id}: ${ticket.subject}`,
			`${user.name} <${user.email}> odpověděl${ticket.status === 'closed' ? ' a znovu otevřel uzavřený požadavek' : ''}.\n\n${body}`
		);
		return { message: ticket.status === 'closed' ? 'Odesláno, požadavek je znovu otevřený.' : 'Odesláno. Ozveme se co nejdřív.' };
	},
	close: async (event) => {
		const user = requireClient(event);
		const ticket = await ownTicket(user.customerId, routeId(event.params.id));
		if (ticket.status === 'closed') return { message: 'Požadavek už je uzavřený.' };
		await db.update(tickets).set({ status: 'closed' }).where(eq(tickets.id, ticket.id));
		await audit(event, 'ticket_close', `#${ticket.id}`, 'zákazník');
		return { message: 'Požadavek je uzavřený. Kdyby něco, stačí odpovědět a znovu se otevře.' };
	}
};
