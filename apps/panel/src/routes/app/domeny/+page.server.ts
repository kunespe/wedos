import { asc, eq } from 'drizzle-orm';
import { requireClient } from '#lib/server/guards.ts';
import { db } from '#lib/server/db/index.ts';
import { domains } from '#lib/server/db/schema.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const user = requireClient(event);
	const rows = await db
		.select({ id: domains.id, name: domains.name, managedByUs: domains.managedByUs, expiresAt: domains.expiresAt })
		.from(domains)
		.where(eq(domains.customerId, user.customerId))
		.orderBy(asc(domains.name));
	return { domains: rows };
};
