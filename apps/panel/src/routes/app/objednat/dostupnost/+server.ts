import { json, type RequestHandler } from '@sveltejs/kit';
import { checkDomain, type DomainCheck } from '#lib/server/domain-check.ts';
import { requireClient } from '#lib/server/guards.ts';
import { rateLimiter } from '#lib/server/public-api.ts';
import { searchNames } from '#lib/domains.ts';

// One search checks up to five names; 20 searches per customer per minute keeps RDAP friendly.
const limited = rateLimiter(20, 60 * 1000);

/** GET /app/objednat/dostupnost?q=firma -> { results: DomainCheck[] } for the typed TLD plus the popular ones. */
export const GET: RequestHandler = async (event) => {
	const user = requireClient(event);
	const names = searchNames(event.url.searchParams.get('q') ?? '').slice(0, 5);
	if (!names.length) return json({ results: [] });
	if (limited(String(user.id)))
		return json({ error: 'Moc dotazů najednou, zkuste to prosím za minutu.', results: [] }, { status: 429, headers: { 'Retry-After': '60' } });
	// invalid: the name itself is wrong (a 400 from the checker), so it cannot go to the basket
	const results: (DomainCheck & { invalid: boolean })[] = (await Promise.all(names.map((n) => checkDomain(n)))).map((r) => ({
		...r.body,
		invalid: r.status === 400
	}));
	return json({ results }, { headers: { 'Cache-Control': 'no-store' } });
};
