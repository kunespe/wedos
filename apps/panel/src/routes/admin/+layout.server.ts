import { eq, sql } from 'drizzle-orm';
import { requireAdmin } from '#lib/server/guards.ts';
import { db } from '#lib/server/db/index.ts';
import { orders, tickets } from '#lib/server/db/schema.ts';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async (event) => {
	const user = requireAdmin(event);
	const [[o], [t]] = await Promise.all([
		db.select({ n: sql<number>`count(*)` }).from(orders).where(eq(orders.status, 'new')),
		db.select({ n: sql<number>`count(*)` }).from(tickets).where(eq(tickets.status, 'open'))
	]);
	return { user, badges: { orders: Number(o.n), tickets: Number(t.n) } };
};
