import { fail } from '@sveltejs/kit';
import { eq, isNotNull } from 'drizzle-orm';
import { db } from '#lib/server/db/index.ts';
import { customers, services } from '#lib/server/db/schema.ts';
import { requireAdmin } from '#lib/server/guards.ts';
import { brokerAction } from '#lib/server/ops.ts';
import { loadSnapshot } from '#lib/server/snapshot.ts';
import { DOMAIN_RE } from '#lib/ops.ts';
import type { Actions, PageServerLoad } from './$types';

// fakturor.py normalize() returns more than the shared Snapshot type names.
type Subscription = {
	id: number;
	name: string;
	expires_on: string;
	active: boolean;
	is_expired?: boolean;
	suspend_at?: string;
	past_grace?: boolean;
};

export const load: PageServerLoad = async (event) => {
	requireAdmin(event);
	const [snap, linked] = await Promise.all([
		loadSnapshot(),
		db
			.select({
				id: services.id,
				label: services.label,
				status: services.status,
				subscriptionId: services.fakturorSubscriptionId,
				expiresAt: services.expiresAt,
				manualHold: services.manualHold,
				customer: customers.name,
				company: customers.company
			})
			.from(services)
			.innerJoin(customers, eq(services.customerId, customers.id))
			.where(isNotNull(services.fakturorSubscriptionId))
	]);
	const s = snap.snapshot;
	if (!s) return { error: snap.error, enabled: snap.enabled, billing: null };
	const subs = (s.billing_status.subscriptions ?? []) as Subscription[];
	const known = new Set(subs.map((x) => x.id));
	return {
		error: null,
		enabled: true,
		billing: {
			config: s.billing,
			checkedAt: s.billing_status.checked_at ?? null,
			syncError: s.billing_status.error ?? '',
			subscriptions: subs.map((sub) => ({
				...sub,
				services: linked.filter((l) => l.subscriptionId === sub.id),
				sites: s.sites.filter((x) => x.management.subscription_id === sub.id).map((x) => x.domain_name)
			})),
			// Panel services pointing at an ID Fakturor no longer returns.
			orphans: linked.filter((l) => l.subscriptionId != null && !known.has(l.subscriptionId)),
			sites: s.sites.map((x) => ({
				domain: x.domain_name,
				client: x.management.client ?? '',
				expiresAt: x.management.expires_at ?? '',
				subscriptionId: x.management.subscription_id ?? null,
				manualHold: x.management.manual_hold === true,
				suspended: x.management.suspended === true,
				action: x.billing_status.proposed_action ?? null,
				reason: x.billing_status.reason ?? '',
				subscription: (x.billing_status.subscription as Subscription | undefined) ?? null
			}))
		}
	};
};

export const actions: Actions = {
	sync: async (event) => {
		const r = await brokerAction<{ error?: string }>(event, 'billing_sync', {}, { action: 'billing_sync' });
		if (!r.ok) return r.failure;
		if (r.result.error) return fail(400, { error: r.result.error });
		return { message: 'Fakturor synchronizován. Weby zůstaly beze změny, jde jen o sledování.' };
	},
	hosting: async (event) => {
		const form = await event.request.formData();
		const domain = String(form.get('domain') ?? '');
		const client = String(form.get('client') ?? '').trim();
		const expires_at = String(form.get('expires_at') ?? '');
		const subscription_id = String(form.get('subscription_id') ?? '');
		const manual_hold = form.get('manual_hold') === 'on';
		if (!DOMAIN_RE.test(domain)) return fail(400, { error: 'Neplatná doména.' });
		if (client.length > 120) return fail(400, { error: 'Název klienta je příliš dlouhý.' });
		if (expires_at && !/^\d{4}-\d{2}-\d{2}$/.test(expires_at)) return fail(400, { error: 'Neplatné datum.' });
		if (subscription_id && !/^\d+$/.test(subscription_id)) return fail(400, { error: 'Neplatné ID předplatného.' });
		const r = await brokerAction(
			event,
			'hosting_settings',
			{ domain, client, expires_at, subscription_id, manual_hold },
			{ action: 'hosting_settings', subject: domain, details: `předplatné ${subscription_id || 'žádné'}${manual_hold ? ', ruční výjimka' : ''}` }
		);
		if (!r.ok) return r.failure;
		return { message: `Propojení webu ${domain} uloženo.` };
	}
};
