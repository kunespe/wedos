import { and, eq, sql } from 'drizzle-orm';
import { requireClient } from '#lib/server/guards.ts';
import { db } from '#lib/server/db/index.ts';
import { paymentRequests, tickets } from '#lib/server/db/schema.ts';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async (event) => {
	const user = requireClient(event);
	const [[w], [p]] = await Promise.all([
		db
			.select({ n: sql<number>`count(*)` })
			.from(tickets)
			.where(and(eq(tickets.customerId, user.customerId), eq(tickets.status, 'waiting'))),
		db
			.select({ n: sql<number>`count(*)` })
			.from(paymentRequests)
			.where(and(eq(paymentRequests.customerId, user.customerId), eq(paymentRequests.status, 'unpaid')))
	]);
	return { user: { name: user.name, email: user.email }, badges: { waiting: Number(w.n), unpaid: Number(p.n) } };
};
