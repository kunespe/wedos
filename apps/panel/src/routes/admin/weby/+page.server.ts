import { fail } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { db } from '#lib/server/db/index.ts';
import { customers, services } from '#lib/server/db/schema.ts';
import { requireAdmin } from '#lib/server/guards.ts';
import { brokerAction } from '#lib/server/ops.ts';
import { loadSnapshot } from '#lib/server/snapshot.ts';
import { DOMAIN_RE, isApp, SITE_KINDS, type SiteKind } from '#lib/ops.ts';
import type { Actions, PageServerLoad } from './$types';

type Credentials = { user: string; sftp_password: string; wordpress_password?: string };

export const load: PageServerLoad = async (event) => {
	requireAdmin(event);
	const [snap, rows] = await Promise.all([
		loadSnapshot(),
		db
			.select({
				id: services.id,
				label: services.label,
				domain: services.domain,
				cloudpanelSite: services.cloudpanelSite,
				status: services.status,
				customer: customers.name,
				company: customers.company
			})
			.from(services)
			.innerJoin(customers, eq(services.customerId, customers.id))
	]);
	const s = snap.snapshot;
	const linked = (domain: string) =>
		rows.filter((r) => r.cloudpanelSite === domain || (!r.cloudpanelSite && r.domain === domain));
	return {
		error: snap.error,
		enabled: snap.enabled,
		timestamp: s?.timestamp ?? null,
		sites: s
			? s.sites.map((site) => {
					const kind = site.management.kind || site.application || site.type;
					return {
						id: site.id,
						domain: site.domain_name,
						user: site.user,
						kind,
						app: isApp(kind) || isApp(site.type),
						client: site.management.client ?? '',
						expiresAt: site.management.expires_at ?? '',
						manualHold: site.management.manual_hold === true,
						suspended: site.management.suspended === true,
						services: linked(site.domain_name).map((r) => ({ id: r.id, label: r.label, status: r.status, customer: r.company || r.customer }))
					};
				})
			: null
	};
};

export const actions: Actions = {
	webState: async (event) => {
		const form = await event.request.formData();
		const domain = String(form.get('domain') ?? '');
		const suspend = form.get('suspend') === 'true';
		if (!DOMAIN_RE.test(domain)) return fail(400, { error: 'Neplatná doména.' });
		const r = await brokerAction(event, 'web_state', { domain, suspend }, { action: suspend ? 'web_suspend' : 'web_resume', subject: domain });
		if (!r.ok) return r.failure;
		return { message: suspend ? `Web ${domain} je pozastavený a vrací 503.` : `Web ${domain} znovu běží.` };
	},
	createSite: async (event) => {
		const form = await event.request.formData();
		const domain = String(form.get('domain') ?? '').trim().toLowerCase();
		const kind = String(form.get('kind') ?? '') as SiteKind;
		const values = { domain, kind, port: String(form.get('port') ?? '3000') };
		if (!DOMAIN_RE.test(domain)) return fail(400, { error: 'Zadejte platnou doménu, například klient.cz.', values });
		if (!SITE_KINDS.includes(kind)) return fail(400, { error: 'Vyberte typ webu.', values });
		const data: Record<string, unknown> = { domain, kind };
		if (kind === 'nodejs' || kind === 'bun') {
			const port = Number(values.port);
			if (!Number.isInteger(port) || port < 3000 || port > 9999) return fail(400, { error: 'Port musí být mezi 3000 a 9999.', values });
			data.port = port;
		}
		// Credentials only travel back in this response; they are never audited or logged.
		const r = await brokerAction<Credentials>(event, 'create_site', data, { action: 'site_create', subject: domain, details: kind });
		if (!r.ok) return fail(400, { ...r.failure.data, values });
		return { message: `Web ${domain} je založený.`, created: { domain, kind, credentials: r.result } };
	}
};
