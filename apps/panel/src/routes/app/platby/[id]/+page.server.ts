import { error } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { requireClient } from '#lib/server/guards.ts';
import { db } from '#lib/server/db/index.ts';
import { customers } from '#lib/server/db/schema.ts';
import { routeId } from '#lib/server/client-area.ts';
import { ownPayment } from '#lib/server/client-payments.ts';
import { paymentQr, supplier } from '#lib/server/payments.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const user = requireClient(event);
	const p = await ownPayment(user.customerId, routeId(event.params.id));
	const [[customer], qr] = await Promise.all([
		db
			.select({ name: customers.name, company: customers.company, ico: customers.ico, dic: customers.dic, address: customers.address, email: customers.email })
			.from(customers)
			.where(eq(customers.id, user.customerId)),
		p.status === 'unpaid' ? paymentQr(p) : null
	]);
	if (!customer) error(404, 'Zákazník nenalezen.');
	return { p, customer, qr, supplier: supplier() };
};
