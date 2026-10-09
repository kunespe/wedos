import { fail } from '@sveltejs/kit';
import { and, asc, eq, ne } from 'drizzle-orm';
import { GRAFANA_URL, PROBES_FILE } from '$app/env/private';
import { audit } from '#lib/server/audit.ts';
import { db } from '#lib/server/db/index.ts';
import { customers, services } from '#lib/server/db/schema.ts';
import { requireAdmin } from '#lib/server/guards.ts';
import { writeProbes } from '#lib/server/probes.ts';
import { metricsEnabled, probeHealth } from '#lib/server/prometheus.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	requireAdmin(event);
	// Same selection writeProbes() turns into blackbox targets.
	const rows = (
		await db
			.select({
				id: services.id,
				label: services.label,
				domain: services.domain,
				kind: services.kind,
				customerId: services.customerId,
				customer: customers.name,
				company: customers.company
			})
			.from(services)
			.innerJoin(customers, eq(services.customerId, customers.id))
			.where(and(eq(services.status, 'active'), eq(services.monitored, true), ne(services.domain, '')))
			.orderBy(asc(services.domain))
	).filter((r) => r.kind !== 'domain');
	const health = await probeHealth(rows.map((r) => r.id));
	return {
		grafana: GRAFANA_URL,
		metrics: metricsEnabled(),
		probesFile: PROBES_FILE !== '',
		services: rows.map((r) => ({ ...r, health: health.get(r.id)! }))
	};
};

export const actions: Actions = {
	probes: async (event) => {
		requireAdmin(event);
		if (!PROBES_FILE) return fail(400, { error: 'Cesta k souboru cílů (PROBES_FILE) není nastavená.' });
		try {
			const count = await writeProbes();
			await audit(event, 'probes_write', 'monitoring', `počet cílů: ${count}`);
			return { message: `Cíle monitoringu přegenerovány: ${count} ${count === 1 ? 'cíl' : count >= 2 && count <= 4 ? 'cíle' : 'cílů'}. Alloy si soubor načte do minuty.` };
		} catch (e) {
			console.error('[probes] write failed', e);
			return fail(400, { error: 'Soubor s cíli se nepodařilo zapsat. Zkontrolujte oprávnění k PROBES_FILE.' });
		}
	}
};
