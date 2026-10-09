import { and, eq, lt, sql } from 'drizzle-orm';
import { requireAdmin } from '#lib/server/guards.ts';
import { db } from '#lib/server/db/index.ts';
import { orders, paymentRequests, tickets } from '#lib/server/db/schema.ts';
import { todayPrague } from '#lib/server/payment-ops.ts';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async (event) => {
	const user = requireAdmin(event);
	const [[o], [t], [p]] = await Promise.all([
		db.select({ n: sql<number>`count(*)` }).from(orders).where(eq(orders.status, 'new')),
		db.select({ n: sql<number>`count(*)` }).from(tickets).where(eq(tickets.status, 'open')),
		db
			.select({ n: sql<number>`count(*)` })
			.from(paymentRequests)
			.where(and(eq(paymentRequests.status, 'unpaid'), lt(paymentRequests.dueDate, todayPrague())))
	]);
	return { user, badges: { orders: Number(o.n), tickets: Number(t.n), overduePayments: Number(p.n) } };
};
