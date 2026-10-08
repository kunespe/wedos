import { desc, eq } from 'drizzle-orm';
import { db } from '#lib/server/db/index.ts';
import { orders, plans, users } from '#lib/server/db/schema.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const rows = await db
		.select({
			id: orders.id,
			status: orders.status,
			name: orders.name,
			company: orders.company,
			email: orders.email,
			domain: orders.domain,
			period: orders.period,
			priceMonthly: orders.priceMonthly,
			createdAt: orders.createdAt,
			plan: plans.name,
			assignee: users.name
		})
		.from(orders)
		.leftJoin(plans, eq(orders.planCode, plans.code))
		.leftJoin(users, eq(orders.assigneeId, users.id))
		.orderBy(desc(orders.createdAt))
		.limit(1000);
	return { orders: rows };
};
