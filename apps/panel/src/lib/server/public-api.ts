import { PUBLIC_WEB_ORIGIN } from '$app/env/private';

/** Storefront origins allowed to call the public APIs; several while serveros.cz replaces servero.cz. */
export const storefrontOrigins: readonly string[] = PUBLIC_WEB_ORIGIN;

/** CORS headers for read-only endpoints the serveros.cz storefront calls with fetch.
 * The hook in hooks.server.ts swaps the origin for the caller's when it is another allowed one. */
export const publicGetCors = {
	'Access-Control-Allow-Origin': storefrontOrigins[0],
	'Access-Control-Allow-Methods': 'GET, OPTIONS',
	'Access-Control-Max-Age': '86400',
	Vary: 'Origin'
};

/**
 * Sliding-window limiter per key (client IP), the second line of defence behind nginx.
 * Returns true when the caller is over the limit.
 */
export function rateLimiter(limit: number, windowMs: number) {
	const hits = new Map<string, number[]>();
	return (key: string): boolean => {
		const now = Date.now();
		const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
		recent.push(now);
		hits.set(key, recent);
		if (hits.size > 5000) hits.clear();
		return recent.length > limit;
	};
}
