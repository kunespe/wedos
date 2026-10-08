import { fail } from '@sveltejs/kit';
import { and, asc, eq, isNotNull, lte, notExists } from 'drizzle-orm';
import { audit } from '#lib/server/audit.ts';
import { db } from '#lib/server/db/index.ts';
import { customers, paymentRequests, services } from '#lib/server/db/schema.ts';
import { requireAdmin } from '#lib/server/guards.ts';
import { mailPaymentRequest, todayPrague } from '#lib/server/payment-ops.ts';
import { createRenewalRequest, PaymentError } from '#lib/server/payments.ts';
import type { Actions, PageServerLoad } from './$types';

const HORIZON_DAYS = 30;

/** Active services that expire within the horizon (or already did) and have no open request. */
function dueServices() {
	const until = new Date(Date.parse(todayPrague()) + HORIZON_DAYS * 86_400_000).toISOString().slice(0, 10);
	return db
		.select({
			id: services.id,
			label: services.label,
			period: services.period,
			priceMonthly: services.priceMonthly,
			expiresAt: services.expiresAt,
			customerId: services.customerId,
			customer: customers.name,
			company: customers.company
		})
		.from(services)
		.innerJoin(customers, eq(services.customerId, customers.id))
		.where(
			and(
				eq(services.status, 'active'),
				eq(services.manualHold, false),
				isNotNull(services.expiresAt),
				lte(services.expiresAt, until),
				notExists(
					db
						.select({ id: paymentRequests.id })
						.from(paymentRequests)
						.where(and(eq(paymentRequests.serviceId, services.id), eq(paymentRequests.status, 'unpaid')))
				)
			)
		)
		.orderBy(asc(services.expiresAt));
}

export const load: PageServerLoad = async (event) => {
	requireAdmin(event);
	return { services: await dueServices(), horizon: HORIZON_DAYS };
};

export const actions: Actions = {
	issue: async (event) => {
		const admin = requireAdmin(event);
		const form = await event.request.formData();
		const ids = [...new Set(form.getAll('service').map(Number))].filter((n) => Number.isInteger(n) && n > 0);
		const send = form.get('send') === 'on';
		if (!ids.length) return fail(400, { error: 'Vyberte aspoň jednu službu.' });
		const created: string[] = [];
		const errors: string[] = [];
		let mailed = 0;
		for (const id of ids) {
			try {
				const { id: requestId, vs } = await createRenewalRequest(db, id, admin.id);
				created.push(vs);
				let detail = `služba ${id}`;
				if (send) {
					const { to, sent } = await mailPaymentRequest(requestId, false);
					if (sent) {
						mailed++;
						await db.update(paymentRequests).set({ remindedAt: new Date() }).where(eq(paymentRequests.id, requestId));
					}
					detail += to.length ? `, e-mail ${to.join(', ')}` : ', bez e-mailu';
				}
				await audit(event, 'payment_create', `výzva ${vs}`, detail);
			} catch (e) {
				if (e instanceof PaymentError) errors.push(`služba #${id}: ${e.message}`);
				else throw e;
			}
		}
		const parts = [];
		if (created.length) {
			const n = created.length;
			parts.push(`${n === 1 ? 'Vystavena 1 výzva' : n < 5 ? `Vystaveny ${n} výzvy` : `Vystaveno ${n} výzev`} (${created.join(', ')}).`);
		}
		if (send && created.length) parts.push(mailed ? `E-mailem odesláno ${mailed}.` : 'E-maily se neodeslaly (SMTP není nastavené), výzvy pošlete z detailu.');
		if (errors.length) parts.push(`Nevystaveno: ${errors.join('; ')}`);
		return created.length ? { message: parts.join(' ') } : fail(400, { error: parts.join(' ') });
	}
};
