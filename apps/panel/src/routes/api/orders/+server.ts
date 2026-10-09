import { json, type RequestHandler } from '@sveltejs/kit';
import { ORDER_NOTIFY_EMAIL, ORIGIN, PUBLIC_WEB_ORIGIN, TURNSTILE_SECRET } from '$app/env/private';
import { findPlan } from '#lib/server/catalog.ts';
import { db } from '#lib/server/db/index.ts';
import { orders } from '#lib/server/db/schema.ts';
import { sendMail } from '#lib/server/mail.ts';
import { czk, periodTotal } from '#lib/format.ts';
import { fieldErrors, publicOrderSchema } from '#lib/orders.ts';

const cors = {
	'Access-Control-Allow-Origin': PUBLIC_WEB_ORIGIN,
	'Access-Control-Allow-Methods': 'POST, OPTIONS',
	'Access-Control-Allow-Headers': 'Content-Type',
	'Access-Control-Max-Age': '86400',
	Vary: 'Origin'
};

// Second line of defence behind the nginx limit: 5 orders per IP per 10 minutes.
const WINDOW = 10 * 60 * 1000;
const recent = new Map<string, number[]>();
function limited(ip: string): boolean {
	const now = Date.now();
	const hits = (recent.get(ip) ?? []).filter((t) => now - t < WINDOW);
	hits.push(now);
	recent.set(ip, hits);
	if (recent.size > 5000) recent.clear();
	return hits.length > 5;
}

async function turnstileOk(token: string | undefined, ip: string): Promise<boolean> {
	if (!TURNSTILE_SECRET) return true;
	if (!token) return false;
	try {
		const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
			method: 'POST',
			body: new URLSearchParams({ secret: TURNSTILE_SECRET, response: token, remoteip: ip }),
			signal: AbortSignal.timeout(5000)
		});
		return ((await res.json()) as { success?: boolean }).success === true;
	} catch {
		return false;
	}
}

export const OPTIONS: RequestHandler = () => new Response(null, { status: 204, headers: cors });

export const POST: RequestHandler = async ({ request, getClientAddress }) => {
	const ip = getClientAddress();
	const origin = request.headers.get('origin');
	if (origin && origin !== PUBLIC_WEB_ORIGIN && origin !== ORIGIN)
		return json({ errors: { form: 'Nepovolený původ požadavku.' } }, { status: 403, headers: cors });
	if (limited(ip)) return json({ errors: { form: 'Zkuste to prosím za chvíli.' } }, { status: 429, headers: cors });

	if (Number(request.headers.get('content-length') ?? 0) > 16_384)
		return json({ errors: { form: 'Požadavek je příliš velký.' } }, { status: 413, headers: cors });
	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return json({ errors: { form: 'Neplatná data.' } }, { status: 400, headers: cors });
	}

	const parsed = publicOrderSchema.safeParse(body);
	if (!parsed.success) return json({ errors: fieldErrors(parsed.error) }, { status: 400, headers: cors });
	const order = parsed.data;

	// Bots fill the hidden field; answer like a success so they learn nothing.
	if (order.website) return json({ id: 0 }, { status: 201, headers: cors });
	if (!(await turnstileOk(order.turnstileToken, ip)))
		return json({ errors: { form: 'Ověření, že nejste robot, selhalo. Zkuste to znovu.' } }, { status: 400, headers: cors });

	const plan = await findPlan(order.plan);
	if (!plan || !plan.active) return json({ errors: { plan: 'Tento tarif už nenabízíme.' } }, { status: 400, headers: cors });

	const [{ id }] = await db
		.insert(orders)
		.values({
			planCode: plan.code,
			period: order.period,
			domain: order.domainMode === 'none' ? '' : order.domain,
			domainMode: order.domainMode,
			name: order.name,
			email: order.email,
			phone: order.phone,
			company: order.company,
			ico: order.ico,
			dic: order.dic,
			address: order.address,
			note: order.note || null,
			priceMonthly: plan.monthly,
			ip
		})
		.$returningId();

	const price =
		plan.monthly == null
			? 'Individuálně'
			: `${czk(periodTotal(plan.monthly, order.period))} ${order.period === 'year' ? 'ročně' : 'měsíčně'} bez DPH`;
	const summary = [
		`Tarif: ${plan.name} (${price})`,
		order.domain && order.domainMode !== 'none' ? `Doména: ${order.domain} (${order.domainMode === 'register' ? 'registrovat' : 'vlastní'})` : '',
		`Jméno: ${order.name}`,
		order.company ? `Firma: ${order.company}${order.ico ? `, IČO ${order.ico}` : ''}` : '',
		`E-mail: ${order.email}`,
		order.phone ? `Telefon: ${order.phone}` : '',
		order.note ? `\nPoznámka:\n${order.note}` : ''
	]
		.filter(Boolean)
		.join('\n');

	// Mail must never fail the order; both calls swallow their own errors.
	await Promise.all([
		sendMail(ORDER_NOTIFY_EMAIL, `Nová objednávka #${id}: ${plan.name}`, `${summary}\n\nDetail: ${ORIGIN}/admin/objednavky/${id}`),
		sendMail(
			order.email,
			`SERVERO: objednávka č. ${id} je u nás`,
			`Dobrý den,\n\nděkujeme za objednávku. Ozveme se do pár hodin (v pracovní době) s přístupy a dalšími kroky.\n\n${summary}\n\nTým SERVERO\ninfo@servero.cz, +420 773 559 645`
		)
	]);

	return json({ id }, { status: 201, headers: cors });
};
