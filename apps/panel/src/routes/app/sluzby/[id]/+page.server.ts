import { and, desc, eq } from 'drizzle-orm';
import { requireClient } from '#lib/server/guards.ts';
import { db } from '#lib/server/db/index.ts';
import { plans, services, tickets } from '#lib/server/db/schema.ts';
import { healthOf, ownService, routeId } from '#lib/server/client-area.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const user = requireClient(event);
	const service = await ownService(user.customerId, routeId(event.params.id));
	const [plan, related, health, info] = await Promise.all([
		service.planCode
			? db
					.select({ name: plans.name, features: plans.features, monthly: plans.monthly })
					.from(plans)
					.where(eq(plans.code, service.planCode))
					.then((r) => r[0] ?? null)
			: null,
		db
			.select({ id: tickets.id, subject: tickets.subject, status: tickets.status, updatedAt: tickets.updatedAt })
			.from(tickets)
			.where(and(eq(tickets.customerId, user.customerId), eq(tickets.serviceId, service.id)))
			.orderBy(desc(tickets.updatedAt))
			.limit(10),
		service.status === 'active' ? healthOf([service.id]).then((h) => h[service.id]) : undefined,
		// Connection details the team filled in; ownService above already proved the service is this customer's.
		db
			.select({ clientInfo: services.clientInfo })
			.from(services)
			.where(and(eq(services.id, service.id), eq(services.customerId, user.customerId)))
			.then((r) => r[0]?.clientInfo ?? [])
	]);
	return { service, plan, related, health, connection: info };
};
