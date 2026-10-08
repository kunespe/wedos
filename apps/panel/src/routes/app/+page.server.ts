import { and, asc, desc, eq, isNotNull, lte, ne } from 'drizzle-orm';
import { requireClient } from '#lib/server/guards.ts';
import { db } from '#lib/server/db/index.ts';
import { domains, plans, services, tickets } from '#lib/server/db/schema.ts';
import { clientServiceColumns, healthOf } from '#lib/server/client-area.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const user = requireClient(event);
	const in60 = new Date(Date.now() + 60 * 86_400_000).toISOString().slice(0, 10);
	const [serviceRows, openTickets, expiringDomains] = await Promise.all([
		db
			.select({ ...clientServiceColumns, plan: plans.name })
			.from(services)
			.leftJoin(plans, eq(services.planCode, plans.code))
			.where(and(eq(services.customerId, user.customerId), ne(services.status, 'cancelled')))
			.orderBy(asc(services.createdAt)),
		db
			.select({ id: tickets.id, subject: tickets.subject, status: tickets.status, updatedAt: tickets.updatedAt })
			.from(tickets)
			.where(and(eq(tickets.customerId, user.customerId), ne(tickets.status, 'closed')))
			.orderBy(desc(tickets.updatedAt))
			.limit(6),
		db
			.select({ id: domains.id, name: domains.name, expiresAt: domains.expiresAt, managedByUs: domains.managedByUs })
			.from(domains)
			.where(and(eq(domains.customerId, user.customerId), isNotNull(domains.expiresAt), lte(domains.expiresAt, in60)))
			.orderBy(asc(domains.expiresAt))
	]);
	const health = await healthOf(serviceRows.filter((s) => s.status === 'active').map((s) => s.id));
	return { name: user.name, services: serviceRows, health, openTickets, expiringDomains };
};
