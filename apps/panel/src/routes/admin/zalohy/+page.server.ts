import { requireAdmin } from '#lib/server/guards.ts';
import { loadSnapshot } from '#lib/server/snapshot.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	requireAdmin(event);
	const snap = await loadSnapshot();
	const s = snap.snapshot;
	return {
		error: snap.error,
		enabled: snap.enabled,
		s3Ready: s?.s3_ready ?? false,
		backups: s
			? s.backups.map((b) => ({
					...b,
					domain: s.wordpress.find((w) => w.path === b.path)?.domain ?? b.path.split('/').pop() ?? b.path
				}))
			: null
	};
};
