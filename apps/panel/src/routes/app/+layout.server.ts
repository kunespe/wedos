import { and, eq, sql } from 'drizzle-orm';
import { requireClient } from '#lib/server/guards.ts';
import { db } from '#lib/server/db/index.ts';
import { tickets } from '#lib/server/db/schema.ts';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async (event) => {
	const user = requireClient(event);
	const [w] = await db
		.select({ n: sql<number>`count(*)` })
		.from(tickets)
		.where(and(eq(tickets.customerId, user.customerId), eq(tickets.status, 'waiting')));
	return { user: { name: user.name, email: user.email }, badges: { waiting: Number(w.n) } };
};
