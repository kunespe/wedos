import type { RequestEvent } from '@sveltejs/kit';
import { db } from './db';
import { auditLog } from './db/schema';

/** Records who did what; never put secrets into details. */
export async function audit(event: RequestEvent, action: string, subject = '', details = '') {
	await db.insert(auditLog).values({
		actorId: event.locals.user?.id ?? null,
		action,
		subject: subject.slice(0, 120),
		details: details || null,
		ip: event.getClientAddress()
	});
}
