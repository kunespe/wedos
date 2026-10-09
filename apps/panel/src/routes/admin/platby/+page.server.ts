import { requireAdmin } from '#lib/server/guards.ts';
import { paymentRows, todayPrague } from '#lib/server/payment-ops.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	requireAdmin(event);
	return { payments: await paymentRows().limit(2000), today: todayPrague() };
};
