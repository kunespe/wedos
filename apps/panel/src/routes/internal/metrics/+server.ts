import { error, type RequestHandler } from '@sveltejs/kit';
import { sql } from 'drizzle-orm';
import { db } from '#lib/server/db/index.ts';
import { domains, orders, paymentRequests, services, tickets } from '#lib/server/db/schema.ts';
import { todayPrague } from '#lib/server/payment-ops.ts';

/**
 * Prometheus text format for Alloy, which scrapes 127.0.0.1:3000 directly.
 * Anything that came through nginx carries X-Forwarded-For and is refused; nginx also blocks /internal/.
 * (getClientAddress is avoided: with ADDRESS_HEADER set it throws on requests without the header.)
 */
export const GET: RequestHandler = async ({ request }) => {
	if (request.headers.has('x-forwarded-for') || request.headers.has('x-real-ip')) error(404);

	const [orderRows, serviceRows, ticketRows, domainRows] = await Promise.all([
		db.select({ status: orders.status, n: sql<number>`count(*)` }).from(orders).groupBy(orders.status),
		db
			.select({ status: services.status, kind: services.kind, n: sql<number>`count(*)` })
			.from(services)
			.groupBy(services.status, services.kind),
		db.select({ status: tickets.status, n: sql<number>`count(*)` }).from(tickets).groupBy(tickets.status),
		db.select({ name: domains.name, expiresAt: domains.expiresAt }).from(domains).where(sql`${domains.expiresAt} is not null`)
	]);
	const mrr = await db
		.select({ total: sql<number>`coalesce(sum(${services.priceMonthly}), 0)` })
		.from(services)
		.where(sql`${services.status} = 'active'`);
	const [payments] = await db
		.select({
			unpaid: sql<number>`coalesce(sum(${paymentRequests.amount}), 0)`,
			overdue: sql<number>`coalesce(sum(${paymentRequests.dueDate} < ${todayPrague()}), 0)`
		})
		.from(paymentRequests)
		.where(sql`${paymentRequests.status} = 'unpaid'`);

	// Waiting times behind the SLA alerts: the oldest order nobody has picked up, the oldest ticket
	// waiting for our answer, and active services whose paid period has run out (not on manual hold).
	const [[oldestOrder], [oldestTicket], [expired]] = await Promise.all([
		db.select({ at: sql<string | null>`min(${orders.createdAt})` }).from(orders).where(sql`${orders.status} = 'new'`),
		db.select({ at: sql<string | null>`min(${tickets.updatedAt})` }).from(tickets).where(sql`${tickets.status} = 'open'`),
		db
			.select({ n: sql<number>`count(*)` })
			.from(services)
			.where(sql`${services.status} = 'active' and ${services.manualHold} = false and ${services.expiresAt} < ${todayPrague()}`)
	]);
	const ageSeconds = (at: string | Date | null | undefined) => (at ? Math.max(0, Math.floor((Date.now() - new Date(at).getTime()) / 1000)) : 0);

	const esc = (v: string) => v.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
	const lines = [
		'# HELP servero_orders_total Orders by status.',
		'# TYPE servero_orders_total gauge',
		...orderRows.map((r) => `servero_orders_total{status="${r.status}"} ${Number(r.n)}`),
		'# HELP servero_services_total Services by status and kind.',
		'# TYPE servero_services_total gauge',
		...serviceRows.map((r) => `servero_services_total{status="${r.status}",kind="${r.kind}"} ${Number(r.n)}`),
		'# HELP servero_tickets_total Tickets by status.',
		'# TYPE servero_tickets_total gauge',
		...ticketRows.map((r) => `servero_tickets_total{status="${r.status}"} ${Number(r.n)}`),
		'# HELP servero_mrr_czk Monthly recurring revenue of active services, CZK excl. VAT.',
		'# TYPE servero_mrr_czk gauge',
		`servero_mrr_czk ${Number(mrr[0]?.total ?? 0)}`,
		'# HELP servero_payments_unpaid_czk Sum of unpaid payment requests, CZK as billed (incl. VAT when charged).',
		'# TYPE servero_payments_unpaid_czk gauge',
		`servero_payments_unpaid_czk ${Number(payments?.unpaid ?? 0)}`,
		'# HELP servero_payments_overdue_total Unpaid payment requests past their due date.',
		'# TYPE servero_payments_overdue_total gauge',
		`servero_payments_overdue_total ${Number(payments?.overdue ?? 0)}`,
		'# HELP servero_order_oldest_new_age_seconds Age of the oldest order still in status new (0 when none).',
		'# TYPE servero_order_oldest_new_age_seconds gauge',
		`servero_order_oldest_new_age_seconds ${ageSeconds(oldestOrder?.at)}`,
		'# HELP servero_ticket_oldest_open_age_seconds Time the longest-waiting open ticket has waited for our reply (0 when none).',
		'# TYPE servero_ticket_oldest_open_age_seconds gauge',
		`servero_ticket_oldest_open_age_seconds ${ageSeconds(oldestTicket?.at)}`,
		'# HELP servero_services_expired_total Active services past their paid period and not on manual hold.',
		'# TYPE servero_services_expired_total gauge',
		`servero_services_expired_total ${Number(expired?.n ?? 0)}`,
		'# HELP servero_domain_expiry_timestamp_seconds Domain expiry as a Unix timestamp.',
		'# TYPE servero_domain_expiry_timestamp_seconds gauge',
		...domainRows.map(
			(r) => `servero_domain_expiry_timestamp_seconds{domain="${esc(r.name)}"} ${Math.floor(new Date(r.expiresAt!).getTime() / 1000)}`
		)
	];
	return new Response(lines.join('\n') + '\n', { headers: { 'Content-Type': 'text/plain; version=0.0.4' } });
};
