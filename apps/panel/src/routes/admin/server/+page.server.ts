import { fail, redirect } from '@sveltejs/kit';
import { asc } from 'drizzle-orm';
import { CLOUDPANEL_URL } from '$app/env/private';
import { db } from '#lib/server/db/index.ts';
import { nodes } from '#lib/server/db/schema.ts';
import { requireAdmin } from '#lib/server/guards.ts';
import { brokerAction } from '#lib/server/ops.ts';
import { loadSnapshot } from '#lib/server/snapshot.ts';
import type { Actions, PageServerLoad } from './$types';

// update-check.py writes more than the shared Snapshot type names.
type Component = { name: string; current?: string; latest?: string; status?: string; note?: string };
type WpCheck = { path: string; status: string; core?: unknown[]; plugins?: unknown[]; themes?: unknown[] };

export const load: PageServerLoad = async (event) => {
	requireAdmin(event);
	const [snap, nodeRows] = await Promise.all([loadSnapshot(), db.select().from(nodes).orderBy(asc(nodes.id))]);
	const s = snap.snapshot;
	return {
		nodes: nodeRows,
		cloudpanel: CLOUDPANEL_URL !== '',
		error: snap.error,
		enabled: snap.enabled,
		node: s
			? {
					timestamp: s.timestamp,
					memory: { used: s.memory_used, total: s.memory_total },
					disk: { used: s.disk_used, total: s.disk_total },
					load: s.load,
					uptime: s.uptime,
					services: Object.entries(s.services).map(([name, state]) => ({ name, state })),
					runtimes: s.runtimes,
					logs: s.logs,
					events: s.events,
					sites: s.sites.length,
					wordpress: s.wordpress.length,
					updateRunning: s.update_check_running,
					updates: s.updates
						? {
								time: s.updates.time,
								packages: s.updates.packages,
								components: s.updates.components as Component[],
								wordpress: ((s.updates as { wordpress?: WpCheck[] }).wordpress ?? []).map((w) => ({
									path: w.path,
									status: w.status,
									core: w.core?.length ?? 0,
									plugins: w.plugins?.length ?? 0,
									themes: w.themes?.length ?? 0
								})),
								errors: s.updates.errors,
								rebootRequired: s.updates.reboot_required
							}
						: null
				}
			: null
	};
};

export const actions: Actions = {
	updateCheck: async (event) => {
		const r = await brokerAction(event, 'update_check', {}, { action: 'update_check', subject: 'vytvorit-web' });
		if (!r.ok) return r.failure;
		return { message: 'Kontrola byla spuštěna. Výsledky se objeví, jakmile doběhne.' };
	},
	cloudpanel: async (event) => {
		requireAdmin(event);
		if (!CLOUDPANEL_URL) return fail(400, { error: 'CloudPanel není v tomto prostředí nastavený (CLOUDPANEL_URL).' });
		const r = await brokerAction<{ token: string }>(event, 'autologin', {}, { action: 'cloudpanel_login', subject: 'vytvorit-web' });
		if (!r.ok) return r.failure;
		// The token is single-use and expires in 30 s; it is not logged.
		const target = new URL('/autologin', CLOUDPANEL_URL);
		target.searchParams.set('token', r.result.token);
		redirect(303, target.href, { external: [target.origin] });
	}
};
