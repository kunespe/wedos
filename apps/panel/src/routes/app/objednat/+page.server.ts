import { fail } from '@sveltejs/kit';
import { and, desc, eq, gte, inArray, sql } from 'drizzle-orm';
import { ORDER_NOTIFY_EMAIL, ORIGIN } from '$app/env/private';
import { audit } from '#lib/server/audit.ts';
import { activePlans, findPlan } from '#lib/server/catalog.ts';
import { db } from '#lib/server/db/index.ts';
import { customers, orders, plans } from '#lib/server/db/schema.ts';
import { parseForm } from '#lib/server/forms.ts';
import { requireClient } from '#lib/server/guards.ts';
import { sendMail } from '#lib/server/mail.ts';
import { czk, periodTotal } from '#lib/format.ts';
import { basketLines, basketTotal, priced } from '#lib/domains.ts';
import { NON_HOSTING_CATEGORIES, panelOrderSchema } from '#lib/orders.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const user = requireClient(event);
	const [catalog, [customer], open] = await Promise.all([
		activePlans(),
		db
			.select({ name: customers.name, company: customers.company, ico: customers.ico, email: customers.email, phone: customers.phone, address: customers.address })
			.from(customers)
			.where(eq(customers.id, user.customerId)),
		db
			.select({ id: orders.id, status: orders.status, domain: orders.domain, period: orders.period, createdAt: orders.createdAt, plan: plans.name })
			.from(orders)
			.leftJoin(plans, eq(orders.planCode, plans.code))
			.where(and(eq(orders.customerId, user.customerId), inArray(orders.status, ['new', 'contacted', 'provisioning'])))
			.orderBy(desc(orders.createdAt))
			.limit(10)
	]);
	const wanted = event.url.searchParams.get('tarif');
	return {
		plans: catalog.map((p) => ({ code: p.code, category: p.category, kind: p.kind, name: p.name, monthly: p.monthly, priceFrom: p.priceFrom, features: p.features })),
		customer,
		open,
		preselected: catalog.some((p) => p.code === wanted && !NON_HOSTING_CATEGORIES.includes(p.category)) ? wanted : null
	};
};

export const actions: Actions = {
	default: async (event) => {
		const user = requireClient(event);
		const { data, errors } = parseForm(panelOrderSchema, await event.request.formData());
		if (!data) return fail(400, { errors, error: 'Zkontrolujte prosím zvýrazněná pole.' });

		const plan = await findPlan(data.plan);
		if (!plan || !plan.active) return fail(400, { errors: { plan: 'Tento tarif už nenabízíme.' }, error: 'Vyberte prosím jiný tarif.' });

		// A logged-in customer cannot flood the team inbox: at most 5 new orders per hour.
		const [{ n }] = await db
			.select({ n: sql<number>`count(*)` })
			.from(orders)
			.where(and(eq(orders.customerId, user.customerId), gte(orders.createdAt, new Date(Date.now() - 3_600_000))));
		if (Number(n) >= 5) return fail(429, { errors: {}, error: 'Za poslední hodinu jste toho objednali hodně. Zkuste to prosím později nebo nám zavolejte.' });

		// Domains only: no hosting, so no hosting domain either; the basket is the whole order.
		const domainOnly = NON_HOSTING_CATEGORIES.includes(plan.category);
		if (domainOnly && !data.domains.length)
			return fail(400, { errors: { domains: 'Košík domén je prázdný.' }, error: 'Přidejte doménu do košíku, nebo vyberte hosting.' });
		const domainMode = domainOnly ? 'none' : data.domainMode;
		const basket = priced(data.domains);

		const [customer] = await db.select().from(customers).where(eq(customers.id, user.customerId));
		const domain = domainMode === 'none' ? '' : data.domain;
		const [{ id }] = await db
			.insert(orders)
			.values({
				planCode: plan.code,
				period: data.period,
				domain,
				domainMode,
				domains: basket,
				name: customer.name,
				email: customer.email,
				phone: customer.phone,
				company: customer.company,
				ico: customer.ico,
				dic: customer.dic,
				address: customer.address,
				note: data.note || null,
				priceMonthly: plan.monthly,
				customerId: customer.id,
				source: 'panel',
				ip: event.getClientAddress()
			})
			.$returningId();
		await audit(event, 'order_create', `#${id}`, `z panelu: ${plan.code}${basket.length ? `, domény ${basket.length}` : ''}`);

		const { known, unknown } = basketTotal(basket);
		const price = domainOnly
			? `domény za ${czk(known)} bez DPH${unknown ? ', zbytek cen potvrdíme' : ''}`
			: plan.monthly == null
				? 'Individuálně'
				: `${czk(periodTotal(plan.monthly, data.period))} ${data.period === 'year' ? 'ročně' : 'měsíčně'} bez DPH`;
		const summary = [
			domainOnly ? `Objednávka: ${plan.name}, bez hostingu` : `Tarif: ${plan.name} (${price})`,
			domain ? `Doména: ${domain} (${domainMode === 'register' ? 'registrovat' : 'vlastní'})` : '',
			basket.length
				? `Domény (${basket.length}):\n${basketLines(basket)}\nZnámé ceny celkem ${czk(known)} bez DPH${unknown ? `, u ${unknown} ${unknown === 1 ? 'domény' : 'domén'} cenu potvrdíme e-mailem` : ''}`
				: '',
			`Zákazník: ${customer.company || customer.name} (#${customer.id}), objednal ${user.name} <${user.email}>`,
			data.note ? `\nPoznámka:\n${data.note}` : ''
		]
			.filter(Boolean)
			.join('\n');
		await sendMail(ORDER_NOTIFY_EMAIL, `Nová objednávka z panelu #${id}: ${plan.name}`, `${summary}\n\nDetail: ${ORIGIN}/admin/objednavky/${id}`);

		return { ordered: { id, plan: plan.name, price, domain, domains: basket.map((d) => d.name) } };
	}
};
