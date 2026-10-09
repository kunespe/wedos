import { desc, eq } from 'drizzle-orm';
import { db } from '#lib/server/db/index.ts';
import { customers, nodes, services } from '#lib/server/db/schema.ts';
import { requireAdmin } from '#lib/server/guards.ts';
import { probeHealth } from '#lib/server/prometheus.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	requireAdmin(event);
	const rows = await db
		.select({
			id: services.id,
			label: services.label,
			kind: services.kind,
			domain: services.domain,
			status: services.status,
			priceMonthly: services.priceMonthly,
			period: services.period,
			expiresAt: services.expiresAt,
			manualHold: services.manualHold,
			customerId: customers.id,
			customer: customers.name,
			company: customers.company,
			node: nodes.name
		})
		.from(services)
		.innerJoin(customers, eq(services.customerId, customers.id))
		.leftJoin(nodes, eq(services.nodeId, nodes.id))
		.orderBy(desc(services.createdAt));
	const health = await probeHealth(rows.filter((r) => r.status === 'active').map((r) => r.id));
	return { services: rows.map((r) => ({ ...r, up: health.get(r.id)?.up ?? null })) };
};
