import { requireAdmin } from '#lib/server/guards.ts';
import { brokerAction } from '#lib/server/ops.ts';
import { loadSnapshot } from '#lib/server/snapshot.ts';
import type { Actions, PageServerLoad } from './$types';

type WpCheck = { path: string; status: string; core?: unknown[]; plugins?: unknown[]; themes?: unknown[] };

export const load: PageServerLoad = async (event) => {
	requireAdmin(event);
	const snap = await loadSnapshot();
	const s = snap.snapshot;
	if (!s) return { error: snap.error, enabled: snap.enabled, wp: null };
	const checks = ((s.updates as { wordpress?: WpCheck[] } | null)?.wordpress ?? []) as WpCheck[];
	const lastBackup = (path: string) => s.backups.filter((b) => b.path === path).sort((a, b) => b.time - a.time)[0] ?? null;
	return {
		error: null,
		enabled: true,
		wp: {
			automation: s.wp_config.enabled,
			s3Ready: s.s3_ready,
			logs: s.logs,
			checkedAt: s.updates?.time ?? null,
			installs: s.wordpress.map((w) => {
				const c = checks.find((x) => x.path === w.path);
				const b = lastBackup(w.path);
				return {
					...w,
					suspended: s.sites.find((x) => x.domain_name === w.domain)?.management.suspended === true,
					check: c ? { status: c.status, pending: (c.core?.length ?? 0) + (c.plugins?.length ?? 0) + (c.themes?.length ?? 0) } : null,
					backup: b ? { time: b.time, success: b.success, storage: b.storage } : null
				};
			})
		}
	};
};

export const actions: Actions = {
	settings: async (event) => {
		const enabled = (await event.request.formData()).get('enabled') === 'true';
		const r = await brokerAction(event, 'wordpress_settings', { enabled }, { action: 'wordpress_settings', details: enabled ? 'zapnuto' : 'vypnuto' });
		if (!r.ok) return r.failure;
		return { message: enabled ? 'Automatická údržba je zapnutá.' : 'Automatická údržba je vypnutá.' };
	},
	run: async (event) => {
		const r = await brokerAction(event, 'wordpress_run', {}, { action: 'wordpress_run' });
		if (!r.ok) return r.failure;
		return { message: 'Údržba byla spuštěna. Výsledek se objeví v logu níže, obnovte stránku za pár minut.' };
	}
};
