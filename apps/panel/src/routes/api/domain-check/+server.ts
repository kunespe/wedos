import { json, type RequestHandler } from '@sveltejs/kit';
import { checkDomain } from '#lib/server/domain-check.ts';
import { publicGetCors, rateLimiter } from '#lib/server/public-api.ts';

// 30 lookups per IP per minute; behind nginx the IP comes from X-Forwarded-For (ADDRESS_HEADER).
const limited = rateLimiter(30, 60 * 1000);

export const OPTIONS: RequestHandler = () => new Response(null, { status: 204, headers: publicGetCors });

/** GET /api/domain-check?name=firma.cz -> { name, available: true | false | null, reason?, price } */
export const GET: RequestHandler = async ({ url, getClientAddress }) => {
	const name = url.searchParams.get('name') ?? '';
	if (limited(getClientAddress()))
		return json(
			{ name, available: null, reason: 'Moc dotazů najednou, zkuste to prosím za minutu.', price: null },
			{ status: 429, headers: { ...publicGetCors, 'Retry-After': '60' } }
		);
	const { status, body } = await checkDomain(name);
	return json(body, { status, headers: { ...publicGetCors, 'Cache-Control': 'no-store' } });
};
