import { asc, eq } from 'drizzle-orm';
import { requireClient } from '#lib/server/guards.ts';
import { db } from '#lib/server/db/index.ts';
import { plans, services } from '#lib/server/db/schema.ts';
import { clientServiceColumns, healthOf } from '#lib/server/client-area.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const user = requireClient(event);
	const rows = await db
		.select({ ...clientServiceColumns, plan: plans.name })
		.from(services)
		.leftJoin(plans, eq(services.planCode, plans.code))
		.where(eq(services.customerId, user.customerId))
		.orderBy(asc(services.createdAt));
	const health = await healthOf(rows.filter((s) => s.status === 'active').map((s) => s.id));
	return { services: rows, health };
};
