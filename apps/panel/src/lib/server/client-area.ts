import { error } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import { ORDER_NOTIFY_EMAIL, ORIGIN } from '$app/env/private';
import { db } from './db/index.ts';
import { services, tickets } from './db/schema.ts';
import { sendMail } from './mail.ts';
import { probeHealth, type ProbeHealth } from './prometheus.ts';

/** Parses a route id; anything that is not a positive integer is a 404, same as a foreign id. */
export function routeId(raw: string | undefined): number {
	const n = Number(raw);
	if (!Number.isInteger(n) || n <= 0) error(404, 'Nenalezeno.');
	return n;
}

/**
 * Columns a client may see. Internal fields (CloudPanel site, node, Fakturor id, note) stay out of
 * every client query so they cannot leak through page data.
 */
export const clientServiceColumns = {
	id: services.id,
	planCode: services.planCode,
	kind: services.kind,
	label: services.label,
	domain: services.domain,
	status: services.status,
	period: services.period,
	priceMonthly: services.priceMonthly,
	expiresAt: services.expiresAt,
	createdAt: services.createdAt
};

/** One service of this customer, or 404 when it does not exist or belongs to someone else. */
export async function ownService(customerId: number, id: number) {
	const [row] = await db
		.select(clientServiceColumns)
		.from(services)
		.where(and(eq(services.id, id), eq(services.customerId, customerId)));
	if (!row) error(404, 'Služba nenalezena.');
	return row;
}

/** One ticket of this customer, or 404. */
export async function ownTicket(customerId: number, id: number) {
	const [row] = await db
		.select()
		.from(tickets)
		.where(and(eq(tickets.id, id), eq(tickets.customerId, customerId)));
	if (!row) error(404, 'Požadavek nenalezen.');
	return row;
}

/** Probe health as a plain object, so it serialises into page data. */
export async function healthOf(serviceIds: number[]): Promise<Record<number, ProbeHealth>> {
	return Object.fromEntries(await probeHealth(serviceIds));
}

/** Tells the team inbox about client activity on a ticket. Never throws. */
export async function notifyTeam(ticketId: number, subject: string, text: string) {
	await sendMail(ORDER_NOTIFY_EMAIL, subject, `${text}\n\n${ORIGIN}/admin/tikety/${ticketId}`);
}

export const LIMITS = { subject: 200, body: 8000, name: 160 } as const;
