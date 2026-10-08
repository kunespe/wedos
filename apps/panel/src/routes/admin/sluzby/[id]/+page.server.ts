import { error, fail } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { audit } from '#lib/server/audit.ts';
import { broker, BrokerError, brokerEnabled } from '#lib/server/broker.ts';
import { allPlans } from '#lib/server/catalog.ts';
import { db } from '#lib/server/db/index.ts';
import { customers, nodes, orders, services } from '#lib/server/db/schema.ts';
import { checkbox, optionalDate, optionalInt, parseForm } from '#lib/server/forms.ts';
import { requireAdmin } from '#lib/server/guards.ts';
import { probeHealth } from '#lib/server/prometheus.ts';
import { refreshProbes } from '#lib/server/probes.ts';
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
	const [[customer], plans, nodeRows, health, [order]] = await Promise.all([
		db.select().from(customers).where(eq(customers.id, service.customerId)),
		allPlans(),
		db.select({ id: nodes.id, name: nodes.name, host: nodes.host, local: nodes.local }).from(nodes),
		probeHealth([service.id]),
		service.orderId ? db.select({ id: orders.id, createdAt: orders.createdAt }).from(orders).where(eq(orders.id, service.orderId)) : [undefined]
	]);
	return { service, customer, plans, nodes: nodeRows, health: health.get(service.id)!, order, brokerEnabled: brokerEnabled() };
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
	}
};
