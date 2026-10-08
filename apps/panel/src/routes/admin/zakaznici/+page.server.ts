import { eq, sql } from 'drizzle-orm';
import { requireAdmin } from '#lib/server/guards.ts';
import { db } from '#lib/server/db/index.ts';
import { customers, services } from '#lib/server/db/schema.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	requireAdmin(event);
	const rows = await db
		.select({
			id: customers.id,
			name: customers.name,
			company: customers.company,
			ico: customers.ico,
			email: customers.email,
			createdAt: customers.createdAt,
			active: sql<number>`sum(case when ${services.status} = 'active' then 1 else 0 end)`,
			mrr: sql<number>`coalesce(sum(case when ${services.status} = 'active' then ${services.priceMonthly} else 0 end), 0)`
		})
		.from(customers)
		.leftJoin(services, eq(services.customerId, customers.id))
		.groupBy(customers.id);
	return { customers: rows.map((r) => ({ ...r, active: Number(r.active ?? 0), mrr: Number(r.mrr) })) };
};
