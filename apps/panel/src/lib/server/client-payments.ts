// Client-visible payment requests. Internal fields (note, author) never leave the server.
import { error } from '@sveltejs/kit';
import { and, desc, eq } from 'drizzle-orm';
import { db } from './db/index.ts';
import { paymentRequests } from './db/schema.ts';

export const clientPaymentColumns = {
	id: paymentRequests.id,
	vs: paymentRequests.vs,
	serviceId: paymentRequests.serviceId,
	description: paymentRequests.description,
	net: paymentRequests.net,
	vatRate: paymentRequests.vatRate,
	amount: paymentRequests.amount,
	dueDate: paymentRequests.dueDate,
	coversUntil: paymentRequests.coversUntil,
	status: paymentRequests.status,
	paidAt: paymentRequests.paidAt,
	invoiceRef: paymentRequests.invoiceRef,
	createdAt: paymentRequests.createdAt
};

export const clientPayments = (customerId: number) =>
	db
		.select(clientPaymentColumns)
		.from(paymentRequests)
		.where(eq(paymentRequests.customerId, customerId))
		.orderBy(desc(paymentRequests.createdAt), desc(paymentRequests.id));

/** One request of this customer, or 404 when it does not exist or belongs to someone else. */
export async function ownPayment(customerId: number, id: number) {
	const [row] = await db
		.select(clientPaymentColumns)
		.from(paymentRequests)
		.where(and(eq(paymentRequests.id, id), eq(paymentRequests.customerId, customerId)));
	if (!row) error(404, 'Výzva nenalezena.');
	return row;
}
