import { error } from '@sveltejs/kit';
import { and, asc, eq, ne } from 'drizzle-orm';
import { requireClient } from '#lib/server/guards.ts';
import { db } from '#lib/server/db/index.ts';
import { customers, plans, services } from '#lib/server/db/schema.ts';
import { clientPayments } from '#lib/server/client-payments.ts';
import { paymentQr, supplier } from '#lib/server/payments.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const user = requireClient(event);
	const [[billing], subscriptions, payments] = await Promise.all([
		db
			.select({
				name: customers.name,
				company: customers.company,
				ico: customers.ico,
				dic: customers.dic,
				address: customers.address,
				email: customers.email,
				phone: customers.phone
			})
			.from(customers)
			.where(eq(customers.id, user.customerId)),
		db
			.select({
				id: services.id,
				label: services.label,
				status: services.status,
				period: services.period,
				priceMonthly: services.priceMonthly,
				expiresAt: services.expiresAt,
				plan: plans.name
			})
			.from(services)
			.leftJoin(plans, eq(services.planCode, plans.code))
			.where(and(eq(services.customerId, user.customerId), ne(services.status, 'cancelled')))
			.orderBy(asc(services.expiresAt)),
		clientPayments(user.customerId)
	]);
	if (!billing) error(404, 'Zákazník nenalezen.');
	const unpaid = await Promise.all(
		payments
			.filter((p) => p.status === 'unpaid')
			.sort((a, b) => a.dueDate.localeCompare(b.dueDate))
			.map(async (p) => ({ ...p, qr: await paymentQr(p) }))
	);
	const { account, iban } = supplier();
	return { billing, subscriptions, unpaid, history: payments.filter((p) => p.status === 'paid'), bank: { account, iban } };
};
