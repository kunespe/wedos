import { fail, redirect } from '@sveltejs/kit';
import { and, asc, eq, ne } from 'drizzle-orm';
import { audit } from '#lib/server/audit.ts';
import { LIMITS, notifyTeam } from '#lib/server/client-area.ts';
import { requireClient } from '#lib/server/guards.ts';
import { db } from '#lib/server/db/index.ts';
import { services, ticketMessages, tickets } from '#lib/server/db/schema.ts';
import type { Actions, PageServerLoad } from './$types';

const ownServices = (customerId: number) =>
	db
		.select({ id: services.id, label: services.label })
		.from(services)
		.where(and(eq(services.customerId, customerId), ne(services.status, 'cancelled')))
		.orderBy(asc(services.label));

export const load: PageServerLoad = async (event) => {
	const user = requireClient(event);
	const list = await ownServices(user.customerId);
	const wanted = Number(event.url.searchParams.get('sluzba'));
	const preselected = list.some((s) => s.id === wanted) ? wanted : null;
	const subject = (event.url.searchParams.get('predmet') ?? '').slice(0, LIMITS.subject);
	return { services: list, preselected, subject, limits: LIMITS };
};

export const actions: Actions = {
	default: async (event) => {
		const user = requireClient(event);
		const form = await event.request.formData();
		const subject = String(form.get('subject') ?? '').trim();
		const body = String(form.get('body') ?? '').trim();
		const rawService = String(form.get('service') ?? '');
		const values = { subject, body, service: rawService };

		if (!subject) return fail(400, { ...values, error: 'Napište předmět.' });
		if (subject.length > LIMITS.subject) return fail(400, { ...values, error: `Předmět může mít nejvýš ${LIMITS.subject} znaků.` });
		if (!body) return fail(400, { ...values, error: 'Popište, s čím potřebujete pomoct.' });
		if (body.length > LIMITS.body) return fail(400, { ...values, error: `Zpráva může mít nejvýš ${LIMITS.body} znaků.` });

		let serviceId: number | null = null;
		let serviceLabel = '';
		if (rawService) {
			const own = (await ownServices(user.customerId)).find((s) => s.id === Number(rawService));
			if (!own) return fail(400, { ...values, service: '', error: 'Vybraná služba neexistuje.' });
			serviceId = own.id;
			serviceLabel = own.label;
		}

		const ticketId = await db.transaction(async (tx) => {
			const [{ id }] = await tx
				.insert(tickets)
				.values({ customerId: user.customerId, serviceId, subject, status: 'open', createdById: user.id })
				.$returningId();
			await tx.insert(ticketMessages).values({ ticketId: id, authorId: user.id, body });
			return id;
		});
		await audit(event, 'ticket_create', `#${ticketId}`, subject);
		await notifyTeam(
			ticketId,
			`SERVERO: nový požadavek #${ticketId}: ${subject}`,
			`${user.name} <${user.email}> založil požadavek${serviceLabel ? ` ke službě ${serviceLabel}` : ''}.\n\n${body}`
		);
		redirect(303, `/app/podpora/${ticketId}?nove=1`);
	}
};
