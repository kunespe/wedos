import { asc, eq } from 'drizzle-orm';
import { db } from '#lib/server/db/index.ts';
import { customers, domains } from '#lib/server/db/schema.ts';
import { requireAdmin } from '#lib/server/guards.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	requireAdmin(event);
	const rows = await db
		.select({
			id: domains.id,
			name: domains.name,
			registrar: domains.registrar,
			managedByUs: domains.managedByUs,
			expiresAt: domains.expiresAt,
			customerId: customers.id,
			customer: customers.name,
			company: customers.company
		})
		.from(domains)
		.innerJoin(customers, eq(domains.customerId, customers.id))
		.orderBy(asc(domains.expiresAt));
	return { domains: rows };
};
