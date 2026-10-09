import { fail, type RequestEvent } from '@sveltejs/kit';
import { asc, eq } from 'drizzle-orm';
import { db } from '#lib/server/db/index.ts';
import { customers, domains } from '#lib/server/db/schema.ts';
import { requireAdmin } from '#lib/server/guards.ts';
import { compareDomains, listDomains, ping, WapiError, wedosStatus } from '#lib/server/wedos.ts';
import type { Actions, PageServerLoad } from './$types';

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
	return { domains: rows, wedos: wedosStatus() };
};

/** Read-only WEDOS calls: no confirm step and no test flag needed. */
async function readOnly<T>(event: RequestEvent, run: () => Promise<T>) {
	requireAdmin(event);
	if (!wedosStatus().configured) return fail(400, { error: 'WEDOS není v tomto prostředí nastavený.' });
	try {
		return await run();
	} catch (e) {
		if (e instanceof WapiError) return fail(502, { error: e.message });
		throw e;
	}
}

export const actions: Actions = {
	ping: (event) =>
		readOnly(event, async () => {
			const started = Date.now();
			const r = await ping();
			return { ping: { ms: Date.now() - started, result: r.result, at: new Date().toISOString() }, message: `WAPI odpovídá (${r.code} ${r.result}).` };
		}),
	compare: (event) =>
		readOnly(event, async () => {
			const [atWedos, panel] = await Promise.all([listDomains(), db.select({ id: domains.id, name: domains.name, registrar: domains.registrar }).from(domains)]);
			return { compare: { total: atWedos.length, ...compareDomains(atWedos, panel) } };
		})
};
