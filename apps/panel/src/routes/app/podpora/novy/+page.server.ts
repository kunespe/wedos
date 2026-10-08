import { fail, redirect } from '@sveltejs/kit';
import { and, asc, eq, ne } from 'drizzle-orm';
import { audit } from '#lib/server/audit.ts';
import { activePlans } from '#lib/server/catalog.ts';
import { notifyTeam } from '#lib/server/client-area.ts';
import { requireClient } from '#lib/server/guards.ts';
import { db } from '#lib/server/db/index.ts';
import { domains, plans, services, ticketMessages, tickets } from '#lib/server/db/schema.ts';
import { parseForm } from '#lib/server/forms.ts';
import { TICKET_CATEGORIES, type TicketCategory } from '#lib/constants.ts';
import { buildRequest, detailsText, REQUEST_LIMITS, REQUEST_SCHEMAS, REQUESTS } from '#lib/requests.ts';
import type { Actions, PageServerLoad } from './$types';

/** The customer's live services; the only ones a request may reference. */
const ownServices = (customerId: number) =>
	db
		.select({ id: services.id, label: services.label, kind: services.kind, domain: services.domain, planCode: services.planCode, planCategory: plans.category })
		.from(services)
		.leftJoin(plans, eq(services.planCode, plans.code))
		.where(and(eq(services.customerId, customerId), ne(services.status, 'cancelled')))
		.orderBy(asc(services.label));

type OwnService = Awaited<ReturnType<typeof ownServices>>[number];

/** Domains the customer may file DNS changes for: registered domains plus the domains of their services. */
async function ownDomains(customerId: number, list: OwnService[]) {
	const rows = await db.select({ name: domains.name }).from(domains).where(eq(domains.customerId, customerId));
	return [...new Set([...rows.map((r) => r.name), ...list.map((s) => s.domain).filter(Boolean)])].sort();
}

/** Active plans a service may switch to: same kind (and catalog category when known), never the current one. */
const plansFor = (s: Pick<OwnService, 'kind' | 'planCode' | 'planCategory'>, all: Awaited<ReturnType<typeof activePlans>>) =>
	all.filter((p) => p.code !== s.planCode && p.kind === s.kind && (!s.planCategory || p.category === s.planCategory));

const isCategory = (v: string | null): v is TicketCategory => TICKET_CATEGORIES.includes(v as TicketCategory);

export const load: PageServerLoad = async (event) => {
	const user = requireClient(event);
	const [list, all] = await Promise.all([ownServices(user.customerId), activePlans()]);
	const domainList = await ownDomains(user.customerId, list);
	const wanted = Number(event.url.searchParams.get('sluzba'));
	const preselected = list.some((s) => s.id === wanted) ? wanted : null;
	const subject = (event.url.searchParams.get('predmet') ?? '').slice(0, REQUEST_LIMITS.subject);
	const typ = event.url.searchParams.get('typ');
	const category: TicketCategory | null = isCategory(typ) ? typ : subject ? 'general' : null;
	return {
		category,
		services: list.map((s) => ({ id: s.id, label: s.label, kind: s.kind, plans: plansFor(s, all).map((p) => p.code) })),
		plans: all.map((p) => ({ code: p.code, name: p.name, monthly: p.monthly, priceFrom: p.priceFrom })),
		domains: domainList,
		preselected,
		// DNS requests opened from a service start on that service's domain.
		preselectedDomain: list.find((s) => s.id === preselected)?.domain || null,
		subject,
		limits: REQUEST_LIMITS
	};
};

export const actions: Actions = {
	default: async (event) => {
		const user = requireClient(event);
		const form = await event.request.formData();
		const rawCategory = String(form.get('category') ?? '');
		if (!isCategory(rawCategory)) return fail(400, { category: null, values: {} as Record<string, string>, errors: {} as Record<string, string>, error: 'Vyberte typ požadavku.' });
		const category = rawCategory;
		const def = REQUESTS[category];
		// Echoed back so the form keeps its input; a pasted private key is never sent back to the browser.
		const values = Object.fromEntries([...form.entries()].map(([k, v]) => [k, /PRIVATE KEY/i.test(String(v)) ? '' : String(v)]));
		const bad = (errors: Record<string, string>, error = 'Zkontrolujte prosím zvýrazněná pole.') => fail(400, { category, values, errors, error });

		const { data, errors } = parseForm(REQUEST_SCHEMAS[category], form);
		if (!data) return bad(errors);
		const d = data as Record<string, unknown> & { service?: number; body: string };
		if (def.bodyRequired && !d.body) return bad({ body: category === 'incident' ? 'Popište, co nefunguje.' : 'Napište zprávu.' });

		// Ownership and fit are checked here, never trusted from the form.
		const list = await ownServices(user.customerId);
		let service: OwnService | undefined;
		if (def.service !== 'none' && d.service != null) {
			service = list.find((s) => s.id === d.service);
			if (!service) return bad({ service: 'Tuto službu u vás nevidíme.' });
			if (def.serviceKinds && !def.serviceKinds.includes(service.kind)) return bad({ service: 'Tento požadavek se k vybrané službě nehodí.' });
		}
		if (def.service === 'required' && !service) return bad({ service: 'Vyberte službu.' });

		let planName: string | undefined;
		if (category === 'change_plan' && service) {
			const code = String(d.plan);
			const target = plansFor(service, await activePlans()).find((p) => p.code === code);
			if (!target) return bad({ plan: 'Na tento tarif službu převést nejde. Vyberte jiný.' });
			planName = target.name;
		}

		if (category === 'dns') {
			const domain = String(d.domain);
			if (!(await ownDomains(user.customerId, list)).includes(domain)) return bad({ domain: 'Tuto doménu u vás nevidíme.' });
			// Link the request to the service running on that domain, when there is one.
			service = list.find((s) => s.domain === domain);
		}

		const { subject, details } = buildRequest(category, d, { serviceLabel: service?.label, planName });
		const summary = detailsText(details);
		const body = d.body || summary || def.label;

		const ticketId = await db.transaction(async (tx) => {
			const [{ id }] = await tx
				.insert(tickets)
				.values({
					customerId: user.customerId,
					serviceId: service?.id ?? null,
					subject,
					status: 'open',
					category,
					details: Object.keys(details).length ? details : null,
					createdById: user.id
				})
				.$returningId();
			await tx.insert(ticketMessages).values({ ticketId: id, authorId: user.id, body });
			return id;
		});
		await audit(event, 'ticket_create', `#${ticketId}`, `${category}: ${subject}`);
		await notifyTeam(
			ticketId,
			`SERVERO: ${def.urgent ? 'NALÉHAVÉ, ' : ''}nový požadavek #${ticketId}: ${subject}`,
			[`${user.name} <${user.email}> založil požadavek „${def.label}“.`, summary, d.body ? `Poznámka:\n${d.body}` : ''].filter(Boolean).join('\n\n')
		);
		redirect(303, `/app/podpora/${ticketId}?nove=1`);
	}
};
