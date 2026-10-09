import { PUBLIC_WEB_ORIGIN } from '$app/env/private';

/** CORS headers for read-only endpoints the servero.cz storefront calls with fetch. */
export const publicGetCors = {
	'Access-Control-Allow-Origin': PUBLIC_WEB_ORIGIN,
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
