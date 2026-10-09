import { fail, type RequestEvent } from '@sveltejs/kit';
import { audit } from './audit.ts';
import { broker, BrokerError } from './broker.ts';
import { requireAdmin } from './guards.ts';

type AuditEntry = { action: string; subject?: string; details?: string };

/**
 * Runs one broker operation from an admin form action: guard, call, audit, and a 400 with the
 * broker's message instead of a 500 when it refuses or is unreachable.
 * The audit entry is written only after success and must never contain secrets.
 */
export async function brokerAction<T = unknown>(
	event: RequestEvent,
	op: string,
	data: Record<string, unknown>,
	entry: AuditEntry
): Promise<{ ok: true; result: T } | { ok: false; failure: ReturnType<typeof fail<{ error: string }>> }> {
	requireAdmin(event);
	try {
		const result = await broker<T>(op, data);
		await audit(event, entry.action, entry.subject ?? '', entry.details ?? '');
		return { ok: true, result };
	} catch (e) {
		if (e instanceof BrokerError) return { ok: false, failure: fail(400, { error: e.message }) };
		throw e;
	}
}

