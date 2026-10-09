import { allPlans } from '#lib/server/catalog.ts';
import { requireAdmin } from '#lib/server/guards.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	requireAdmin(event);
	return { plans: await allPlans() };
};
