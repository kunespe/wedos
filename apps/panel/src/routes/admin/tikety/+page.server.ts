import { desc, eq, sql } from 'drizzle-orm';
import { db } from '#lib/server/db/index.ts';
import { customers, ticketMessages, tickets } from '#lib/server/db/schema.ts';
import { requireAdmin } from '#lib/server/guards.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	requireAdmin(event);
	const rows = await db
		.select({
			id: tickets.id,
			subject: tickets.subject,
			status: tickets.status,
			category: tickets.category,
			updatedAt: tickets.updatedAt,
			createdAt: tickets.createdAt,
			customerId: customers.id,
			customer: customers.name,
			company: customers.company,
			messages: sql<number>`(select count(*) from ${ticketMessages} where ${ticketMessages.ticketId} = ${tickets.id})`
		})
		.from(tickets)
		.innerJoin(customers, eq(tickets.customerId, customers.id))
		.orderBy(desc(tickets.updatedAt))
		.limit(1000);
	return { tickets: rows.map((r) => ({ ...r, messages: Number(r.messages) })) };
};
