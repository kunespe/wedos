import { publicStatus } from '#lib/server/status.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ setHeaders }) => {
	setHeaders({ 'Cache-Control': 'public, max-age=60' });
	return { status: await publicStatus() };
};
