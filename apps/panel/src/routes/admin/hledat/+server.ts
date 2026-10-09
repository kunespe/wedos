import { json, type RequestHandler } from '@sveltejs/kit';
import { like, or, sql } from 'drizzle-orm';
import { requireAdmin } from '#lib/server/guards.ts';
import { db } from '#lib/server/db/index.ts';
import { customers, domains, orders, services } from '#lib/server/db/schema.ts';

/** Backs the ⌘K palette: customers, services, domains and orders matching the query. */
export const GET: RequestHandler = async (event) => {
	requireAdmin(event);
	const q = (event.url.searchParams.get('q') ?? '').trim().slice(0, 80);
	if (q.length < 2) return json([]);
	const term = `%${q.replace(/[%_\\]/g, '\\$&')}%`;
	const asId = /^#?\d+$/.test(q) ? Number(q.replace('#', '')) : -1;

	const [c, s, d, o] = await Promise.all([
		db
			.select({ id: customers.id, name: customers.name, company: customers.company, email: customers.email })
			.from(customers)
			.where(or(like(customers.name, term), like(customers.company, term), like(customers.email, term), like(customers.ico, term)))
			.limit(6),
		db
			.select({ id: services.id, label: services.label, domain: services.domain })
			.from(services)
			.where(or(like(services.label, term), like(services.domain, term)))
			.limit(6),
		db.select({ id: domains.id, name: domains.name }).from(domains).where(like(domains.name, term)).limit(6),
		db
			.select({ id: orders.id, name: orders.name, domain: orders.domain })
			.from(orders)
			.where(or(sql`${orders.id} = ${asId}`, like(orders.name, term), like(orders.email, term), like(orders.domain, term)))
			.limit(6)
	]);
	return json([
		...c.map((r) => ({ href: `/admin/zakaznici/${r.id}`, label: r.company || r.name, hint: r.email })),
		...s.map((r) => ({ href: `/admin/sluzby/${r.id}`, label: r.label, hint: 'služba' })),
		...d.map((r) => ({ href: `/admin/domeny/${r.id}`, label: r.name, hint: 'doména' })),
		...o.map((r) => ({ href: `/admin/objednavky/${r.id}`, label: `#${r.id} ${r.name}`, hint: r.domain || 'objednávka' }))
	]);
};
