import { and, desc, eq } from 'drizzle-orm';
import { requireClient } from '#lib/server/guards.ts';
import { db } from '#lib/server/db/index.ts';
import { services, tickets } from '#lib/server/db/schema.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const user = requireClient(event);
	const rows = await db
		.select({
			id: tickets.id,
			subject: tickets.subject,
			status: tickets.status,
			category: tickets.category,
			createdAt: tickets.createdAt,
			updatedAt: tickets.updatedAt,
			service: services.label
		})
		.from(tickets)
		.leftJoin(services, and(eq(tickets.serviceId, services.id), eq(services.customerId, user.customerId)))
		.where(eq(tickets.customerId, user.customerId))
		.orderBy(desc(tickets.updatedAt));
	return { tickets: rows };
};
