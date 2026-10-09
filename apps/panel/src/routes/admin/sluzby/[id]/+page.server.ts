import { error, fail } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { audit } from '#lib/server/audit.ts';
import { broker, BrokerError, brokerEnabled } from '#lib/server/broker.ts';
import { allPlans } from '#lib/server/catalog.ts';
import { db } from '#lib/server/db/index.ts';
import { customers, nodes, orders, paymentRequests, services } from '#lib/server/db/schema.ts';
import { checkbox, optionalDate, optionalInt, parseForm } from '#lib/server/forms.ts';
import { requireAdmin } from '#lib/server/guards.ts';
import { paymentRows } from '#lib/server/payment-ops.ts';
import { createRenewalRequest, PaymentError } from '#lib/server/payments.ts';
import { notifyServiceActive } from '#lib/server/notify-service.ts';
import { probeHealth } from '#lib/server/prometheus.ts';
import { refreshProbes } from '#lib/server/probes.ts';
import { clientInfoSchema } from '#lib/client-info.ts';
import { SERVICE_STATUSES } from '#lib/constants.ts';
import type { Actions, PageServerLoad } from './$types';

async function getService(id: number) {
	const [s] = await db.select().from(services).where(eq(services.id, id));
	if (!s) error(404, 'Služba neexistuje.');
	return s;
}

export const load: PageServerLoad = async (event) => {
	requireAdmin(event);
	const service = await getService(Number(event.params.id));
	const [[customer], plans, nodeRows, health, [order], payments] = await Promise.all([
		db.select().from(customers).where(eq(customers.id, service.customerId)),
		allPlans(),
		db.select({ id: nodes.id, name: nodes.name, host: nodes.host, local: nodes.local }).from(nodes),
		probeHealth([service.id]),
		service.orderId ? db.select({ id: orders.id, createdAt: orders.createdAt }).from(orders).where(eq(orders.id, service.orderId)) : [undefined],
		paymentRows(eq(paymentRequests.serviceId, service.id)).limit(20)
	]);
	return { service, customer, plans, nodes: nodeRows, health: health.get(service.id)!, order, payments, brokerEnabled: brokerEnabled() };
};

const serviceSchema = z.object({
	label: z.string().trim().min(2, 'Vyplňte název.').max(160),
	planCode: z.string().trim().max(40).transform((v) => v || null),
	domain: z
		.string()
		.trim()
		.toLowerCase()
		.regex(/^((?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,})?$/, 'Neplatná doména.'),
	status: z.enum(SERVICE_STATUSES),
	period: z.enum(['month', 'year']),
	priceMonthly: optionalInt,
	nodeId: optionalInt,
	cloudpanelSite: z.string().trim().toLowerCase().max(253),
	fakturorSubscriptionId: optionalInt,
	expiresAt: optionalDate,
	manualHold: checkbox,
	monitored: checkbox,
	note: z.string().trim().max(4000).transform((v) => v || null)
});

export const actions: Actions = {
	renew: async (event) => {
		const admin = requireAdmin(event);
		const service = await getService(Number(event.params.id));
		try {
			const { id, vs } = await createRenewalRequest(db, service.id, admin.id);
			await audit(event, 'payment_create', `výzva ${vs}`, `služba ${service.id}`);
			return { message: `Výzva ${vs} vystavena.`, paymentId: id };
		} catch (e) {
			if (e instanceof PaymentError) return fail(400, { error: e.message });
			throw e;
		}
	},
	update: async (event) => {
		requireAdmin(event);
		const service = await getService(Number(event.params.id));
		const { data, errors } = parseForm(serviceSchema, await event.request.formData());
		if (!data) return fail(400, { errors });
		if (data.fakturorSubscriptionId) {
			const [taken] = await db.select({ id: services.id }).from(services).where(eq(services.fakturorSubscriptionId, data.fakturorSubscriptionId));
			if (taken && taken.id !== service.id) return fail(400, { errors: { fakturorSubscriptionId: `Předplatné už má služba #${taken.id}.` } });
		}
		await db.update(services).set(data).where(eq(services.id, service.id));
		const changed = Object.entries(data)
			.filter(([k, v]) => String(service[k as keyof typeof service] ?? '') !== String(v ?? ''))
			.map(([k]) => k);
		await audit(event, 'service_update', `služba ${service.id}`, changed.join(', '));
		refreshProbes();
		// First activation: the customer learns their service is live (manual provisioning is done).
		if (service.status === 'pending' && data.status === 'active') {
			const sent = await notifyServiceActive(service.id);
			return { message: sent ? 'Služba běží. Zákazník dostal e-mail s detaily.' : 'Služba běží. E-mail zákazníkovi se neodeslal (SMTP není nastavené), dejte mu vědět sami.' };
		}
		return { message: 'Služba uložena.' };
	},
	webState: async (event) => {
		requireAdmin(event);
		const service = await getService(Number(event.params.id));
		const suspend = (await event.request.formData()).get('suspend') === '1';
		if (!service.cloudpanelSite) return fail(400, { error: 'Služba nemá přiřazený web v CloudPanelu.' });
		try {
			await broker('web_state', { domain: service.cloudpanelSite, suspend });
		} catch (e) {
			if (e instanceof BrokerError) return fail(400, { error: e.message });
			throw e;
		}
		await db.update(services).set({ status: suspend ? 'suspended' : 'active' }).where(eq(services.id, service.id));
		await audit(event, suspend ? 'web_suspend' : 'web_resume', service.cloudpanelSite, `služba ${service.id}`);
		refreshProbes();
		return { message: suspend ? 'Web pozastaven, návštěvníci vidí 503.' : 'Web znovu běží.' };
	},
	clientInfo: async (event) => {
		requireAdmin(event);
		const service = await getService(Number(event.params.id));
		const form = await event.request.formData();
		const labels = form.getAll('infoLabel').map(String);
		const values = form.getAll('infoValue').map(String);
		const parsed = clientInfoSchema.safeParse(labels.map((label, i) => ({ label, value: values[i] ?? '' })));
		if (!parsed.success) return fail(400, { error: parsed.error.issues[0]?.message ?? 'Neplatné údaje.' });
		await db.update(services).set({ clientInfo: parsed.data.length ? parsed.data : null }).where(eq(services.id, service.id));
		await audit(event, 'service_client_info', `služba ${service.id}`, parsed.data.map((r) => r.label).join(', '));
		return { message: 'Přístupové údaje pro zákazníka uloženy.' };
	}
};
