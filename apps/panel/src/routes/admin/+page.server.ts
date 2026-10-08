import { and, desc, eq, inArray, isNotNull, lte, sql } from 'drizzle-orm';
import { db } from '#lib/server/db/index.ts';
import { customers, domains, orders, plans, services, tickets } from '#lib/server/db/schema.ts';
import { loadSnapshot } from '#lib/server/snapshot.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const in30 = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
	const [openOrders, activeCount, mrr, openTickets, expiringServices, expiringDomains, recentOrders, snap] = await Promise.all([
		db.select({ n: sql<number>`count(*)` }).from(orders).where(inArray(orders.status, ['new', 'contacted', 'provisioning'])),
		db.select({ n: sql<number>`count(*)` }).from(services).where(eq(services.status, 'active')),
		db.select({ total: sql<number>`coalesce(sum(${services.priceMonthly}), 0)` }).from(services).where(eq(services.status, 'active')),
		db.select({ n: sql<number>`count(*)` }).from(tickets).where(eq(tickets.status, 'open')),
		db
			.select({ id: services.id, label: services.label, expiresAt: services.expiresAt, customer: customers.name, manualHold: services.manualHold })
			.from(services)
			.innerJoin(customers, eq(services.customerId, customers.id))
			.where(and(eq(services.status, 'active'), isNotNull(services.expiresAt), lte(services.expiresAt, in30)))
			.orderBy(services.expiresAt)
			.limit(8),
		db
			.select({ id: domains.id, name: domains.name, expiresAt: domains.expiresAt })
			.from(domains)
			.where(and(eq(domains.managedByUs, true), isNotNull(domains.expiresAt), lte(domains.expiresAt, in30)))
			.orderBy(domains.expiresAt)
			.limit(8),
		db
			.select({ id: orders.id, status: orders.status, name: orders.name, company: orders.company, domain: orders.domain, createdAt: orders.createdAt, plan: plans.name })
			.from(orders)
			.leftJoin(plans, eq(orders.planCode, plans.code))
			.orderBy(desc(orders.createdAt))
			.limit(8),
		loadSnapshot()
	]);
	const s = snap.snapshot;
	return {
		stats: {
			openOrders: Number(openOrders[0].n),
			active: Number(activeCount[0].n),
			mrr: Number(mrr[0].total),
			openTickets: Number(openTickets[0].n)
		},
		expiringServices,
		expiringDomains,
		recentOrders,
		node: s
			? {
					memory: s.memory_used / s.memory_total,
					disk: s.disk_used / s.disk_total,
					load: s.load[0],
					failed: Object.entries(s.services).filter(([, v]) => v !== 'active').map(([k]) => k),
					updates: s.updates?.packages?.length ?? 0
				}
			: null,
		snapError: snap.error,
		brokerEnabled: snap.enabled
	};
};
