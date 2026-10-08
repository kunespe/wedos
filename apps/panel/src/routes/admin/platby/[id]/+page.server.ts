import { error, fail } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { audit } from '#lib/server/audit.ts';
import { db } from '#lib/server/db/index.ts';
import { customers, paymentRequests, services, users } from '#lib/server/db/schema.ts';
import { requireAdmin } from '#lib/server/guards.ts';
import { mailPaymentRequest, todayPrague } from '#lib/server/payment-ops.ts';
import { markPaid, paymentQr, PaymentError, supplier } from '#lib/server/payments.ts';
import { date } from '#lib/format.ts';
import type { Actions, PageServerLoad } from './$types';

async function getRequest(raw: string) {
	const id = Number(raw);
	const [p] = Number.isInteger(id) && id > 0 ? await db.select().from(paymentRequests).where(eq(paymentRequests.id, id)) : [];
	if (!p) error(404, 'Výzva neexistuje.');
	return p;
}

const invoiceRef = (form: FormData) => String(form.get('invoiceRef') ?? '').trim().slice(0, 60);

export const load: PageServerLoad = async (event) => {
	requireAdmin(event);
	const p = await getRequest(event.params.id);
	const [[customer], service, author, qr] = await Promise.all([
		db.select().from(customers).where(eq(customers.id, p.customerId)),
		p.serviceId
			? db
					.select({ id: services.id, label: services.label, status: services.status, expiresAt: services.expiresAt, period: services.period })
					.from(services)
					.where(eq(services.id, p.serviceId))
					.then((r) => r[0] ?? null)
			: null,
		p.createdById ? db.select({ name: users.name }).from(users).where(eq(users.id, p.createdById)).then((r) => r[0]?.name ?? null) : null,
		paymentQr(p)
	]);
	const { name, ico, dic, account, iban, vatRate } = supplier();
	return { p, customer, service, author, qr, supplier: { name, ico, dic, account, iban, vatRate } };
};

export const actions: Actions = {
	paid: async (event) => {
		requireAdmin(event);
		const p = await getRequest(event.params.id);
		const ref = invoiceRef(await event.request.formData());
		try {
			const { extended, serviceId } = await markPaid(db, p.id, ref);
			await audit(event, 'payment_paid', `výzva ${p.vs}`, [extended ? `služba ${serviceId} do ${extended}` : '', ref ? `faktura ${ref}` : ''].filter(Boolean).join(', '));
			let message = extended ? `Zaplaceno. Služba je prodloužená do ${date(extended)}.` : 'Zaplaceno.';
			if (serviceId) {
				const [s] = await db.select({ status: services.status }).from(services).where(eq(services.id, serviceId));
				if (s?.status === 'suspended') message += ' Web je pozastavený: obnovte ho ručně v detailu služby (Provoz webu, Obnovit web).';
			}
			if (!ref) message += ' Číslo faktury z Fakturoru doplňte, až ji vystavíte.';
			return { message };
		} catch (e) {
			if (e instanceof PaymentError) return fail(400, { error: e.message });
			throw e;
		}
	},
	remind: async (event) => {
		requireAdmin(event);
		const p = await getRequest(event.params.id);
		if (p.status !== 'unpaid') return fail(400, { error: 'Výzva už není k úhradě.' });
		const reminder = p.remindedAt != null || p.dueDate < todayPrague();
		const { to, sent } = await mailPaymentRequest(p.id, reminder);
		if (!to.length) return fail(400, { error: 'Zákazník nemá žádný e-mail.' });
		await db.update(paymentRequests).set({ remindedAt: new Date() }).where(eq(paymentRequests.id, p.id));
		await audit(event, 'payment_remind', `výzva ${p.vs}`, to.join(', '));
		return {
			message: sent
				? `${reminder ? 'Připomínka odeslána' : 'Výzva odeslána'} na ${to.join(', ')}.`
				: `E-mail se nepodařilo odeslat (SMTP není nastavené nebo selhalo). Adresa: ${to.join(', ')}. Čas připomenutí je uložený.`
		};
	},
	cancel: async (event) => {
		requireAdmin(event);
		const p = await getRequest(event.params.id);
		if (p.status !== 'unpaid') return fail(400, { error: 'Zrušit jde jen nezaplacenou výzvu.' });
		await db.update(paymentRequests).set({ status: 'cancelled' }).where(eq(paymentRequests.id, p.id));
		await audit(event, 'payment_cancel', `výzva ${p.vs}`);
		return { message: 'Výzva zrušena. Zákazník ji v klientské zóně uvidí jako zrušenou.' };
	},
	invoice: async (event) => {
		requireAdmin(event);
		const p = await getRequest(event.params.id);
		if (p.status !== 'paid') return fail(400, { error: 'Číslo faktury patří až k zaplacené výzvě.' });
		const ref = invoiceRef(await event.request.formData());
		await db.update(paymentRequests).set({ invoiceRef: ref }).where(eq(paymentRequests.id, p.id));
		await audit(event, 'payment_invoice', `výzva ${p.vs}`, ref || 'smazáno');
		return { message: ref ? `Faktura ${ref} uložena.` : 'Číslo faktury smazáno.' };
	}
};
