import { redirect } from '@sveltejs/kit';
import type { Handle } from '@sveltejs/kit/hooks';
import { clearSessionCookie, SESSION_COOKIE, validateSession } from '#lib/server/auth/session.ts';

// Paths reachable before the second factor is done.
const PRE_2FA = ['/prihlaseni', '/odhlaseni', '/nastaveni-2fa'];
const PUBLIC = ['/prihlaseni', '/pozvanka', '/api/orders', '/internal/', '/zdravi'];

export const handle: Handle = async ({ event, resolve }) => {
	event.locals.user = null;
	event.locals.sessionToken = null;

	const token = event.cookies.get(SESSION_COOKIE);
	if (token) {
		const found = await validateSession(token);
		if (!found) clearSessionCookie(event.cookies);
		else {
			const { session, user } = found;
			const path = event.url.pathname;
			const allowedPre2fa = PRE_2FA.some((p) => path.startsWith(p));
			if (!session.verified && !allowedPre2fa) redirect(303, '/prihlaseni/overeni');
			if (session.verified) {
				event.locals.user = {
					id: user.id,
					email: user.email,
					name: user.name,
					role: user.role,
					customerId: user.customerId,
					hasTotp: Boolean(user.totpSecret)
				};
				event.locals.sessionToken = token;
				// Admins must enrol a second factor before touching anything.
				if (user.role === 'admin' && !user.totpSecret && !allowedPre2fa)
					redirect(303, '/nastaveni-2fa');
			}
		}
	}

	const response = await resolve(event);
	response.headers.set('X-Content-Type-Options', 'nosniff');
	response.headers.set('Referrer-Policy', 'same-origin');
	response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
	if (!response.headers.has('X-Frame-Options')) response.headers.set('X-Frame-Options', 'DENY');
	if (!PUBLIC.some((p) => event.url.pathname.startsWith(p)) && event.locals.user)
		response.headers.set('Cache-Control', 'no-store');
	return response;
};
