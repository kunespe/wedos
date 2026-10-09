import { requireClient } from '#lib/server/guards.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = (event) => {
	requireClient(event);
};
