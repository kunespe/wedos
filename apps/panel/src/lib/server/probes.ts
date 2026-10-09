import { mkdir, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { and, eq, ne } from 'drizzle-orm';
import { PROBES_FILE } from '$app/env/private';
import { db } from './db';
import { services } from './db/schema';

/**
 * Writes the blackbox targets Alloy watches (file_sd format) from active, monitored services.
 * The panel stays the source of truth; Alloy picks the file up on its own.
 */
export async function writeProbes(): Promise<number> {
	if (!PROBES_FILE) return 0;
	const rows = await db
		.select({ id: services.id, customerId: services.customerId, domain: services.domain, kind: services.kind })
		.from(services)
		.where(and(eq(services.status, 'active'), eq(services.monitored, true), ne(services.domain, '')));
	const targets = rows
		.filter((r) => r.kind !== 'domain')
		.map((r) => ({
			targets: [`https://${r.domain}`],
			labels: { service_id: String(r.id), customer_id: String(r.customerId), domain: r.domain, kind: r.kind }
		}));
	await mkdir(dirname(PROBES_FILE), { recursive: true });
	const tmp = PROBES_FILE + '.tmp';
	await writeFile(tmp, JSON.stringify(targets, null, 1));
	await rename(tmp, PROBES_FILE);
	return targets.length;
}

/** Fire-and-forget variant for request handlers; a monitoring hiccup must not fail a save. */
export function refreshProbes() {
	writeProbes().catch((e) => console.error('[probes] write failed', e));
}
