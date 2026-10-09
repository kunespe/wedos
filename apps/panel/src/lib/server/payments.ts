import { and, eq } from 'drizzle-orm';
import QRCode from 'qrcode';
import { PAYMENT_ACCOUNT, PAYMENT_DUE_DAYS, PAYMENT_IBAN, SUPPLIER_ADDRESS, SUPPLIER_DIC, SUPPLIER_ICO, SUPPLIER_NAME, VAT_RATE } from '$app/env/private';
import { periodTotal } from '../format';
import { nextCoverage, spayd, variableSymbol, withVat } from '../payments';
import type { Db } from './db/client';
import { paymentRequests, services } from './db/schema';

export class PaymentError extends Error {}

export const supplier = () => ({
	name: SUPPLIER_NAME || 'SERVERO',
	ico: SUPPLIER_ICO,
	dic: SUPPLIER_DIC,
	address: SUPPLIER_ADDRESS,
	account: PAYMENT_ACCOUNT,
	iban: PAYMENT_IBAN,
	vatRate: VAT_RATE
});

const dueIn = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);

/** Creates a payment request; the variable symbol is derived from the row id inside one transaction. */
export async function createPaymentRequest(
	db: Db,
	input: { customerId: number; serviceId?: number | null; description: string; net: number; coversUntil?: string | null; createdById?: number | null; note?: string | null; dueDate?: string }
) {
	if (!Number.isInteger(input.net) || input.net <= 0) throw new PaymentError('Částka musí být kladné celé číslo.');
	return db.transaction(async (tx) => {
		const [{ id }] = await tx
			.insert(paymentRequests)
			.values({
				// Placeholder until the id is known; replaced below in the same transaction.
				vs: `tmp${Date.now() % 1e7}`,
				customerId: input.customerId,
				serviceId: input.serviceId ?? null,
				description: input.description.slice(0, 200),
				net: input.net,
				vatRate: VAT_RATE,
				amount: withVat(input.net, VAT_RATE),
				dueDate: input.dueDate ?? dueIn(PAYMENT_DUE_DAYS),
				coversUntil: input.coversUntil ?? null,
				createdById: input.createdById ?? null,
				note: input.note ?? null
			})
			.$returningId();
		const vs = variableSymbol(id);
		await tx.update(paymentRequests).set({ vs }).where(eq(paymentRequests.id, id));
		return { id, vs };
	});
}

/** Builds the renewal request for a service: one billing period at its current price. */
export async function createRenewalRequest(db: Db, serviceId: number, createdById: number | null) {
	const [s] = await db.select().from(services).where(eq(services.id, serviceId));
	if (!s) throw new PaymentError('Služba neexistuje.');
	if (s.priceMonthly == null) throw new PaymentError('Služba nemá cenu; doplňte ji v detailu služby.');
	const [open] = await db
		.select({ id: paymentRequests.id })
		.from(paymentRequests)
		.where(and(eq(paymentRequests.serviceId, s.id), eq(paymentRequests.status, 'unpaid')));
	if (open) throw new PaymentError(`Služba už má nezaplacenou výzvu #${open.id}.`);
	const coversUntil = nextCoverage(s.expiresAt, s.period);
	const net = periodTotal(s.priceMonthly, s.period);
	const until = coversUntil.split('-').reverse().join('. ');
	return createPaymentRequest(db, {
		customerId: s.customerId,
		serviceId: s.id,
		description: `${s.label}, prodloužení do ${until}`,
		net,
		coversUntil,
		createdById
	});
}

/**
 * Records a payment the team saw on the bank statement and extends the linked service.
 * Never resumes a suspended site by itself: that stays a deliberate admin action.
 */
export async function markPaid(db: Db, id: number, invoiceRef = '') {
	return db.transaction(async (tx) => {
		const [p] = await tx.select().from(paymentRequests).where(eq(paymentRequests.id, id)).for('update');
		if (!p) throw new PaymentError('Výzva neexistuje.');
		if (p.status !== 'unpaid') throw new PaymentError('Výzva už není k úhradě.');
		await tx.update(paymentRequests).set({ status: 'paid', paidAt: new Date(), invoiceRef: invoiceRef.slice(0, 60) }).where(eq(paymentRequests.id, id));
		let extended: string | null = null;
		if (p.serviceId && p.coversUntil) {
			const [s] = await tx.select().from(services).where(eq(services.id, p.serviceId));
			if (s && (!s.expiresAt || s.expiresAt < p.coversUntil)) {
				await tx.update(services).set({ expiresAt: p.coversUntil }).where(eq(services.id, s.id));
				extended = p.coversUntil;
			}
		}
		return { extended, serviceId: p.serviceId };
	});
}

/** SVG QR code for a request, or null when the bank account is not configured yet. */
export async function paymentQr(p: { amount: number; vs: string; description: string; dueDate: string }) {
	if (!PAYMENT_IBAN) return null;
	const text = spayd({ iban: PAYMENT_IBAN, amount: p.amount, vs: p.vs, message: `SERVERO ${p.vs}`, dueDate: p.dueDate });
	return QRCode.toString(text, { type: 'svg', margin: 0, errorCorrectionLevel: 'M' });
}
