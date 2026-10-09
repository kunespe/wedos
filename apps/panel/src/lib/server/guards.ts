import { error, redirect, type RequestEvent } from '@sveltejs/kit';

export function requireUser(event: Pick<RequestEvent, 'locals' | 'url'>) {
	const user = event.locals.user;
	if (!user) redirect(303, '/prihlaseni?next=' + encodeURIComponent(event.url.pathname + event.url.search));
	return user;
}

export function requireAdmin(event: Pick<RequestEvent, 'locals' | 'url'>) {
	const user = requireUser(event);
	if (user.role !== 'admin') error(403, 'Sem nemáte přístup.');
	return user;
}

export function requireClient(event: Pick<RequestEvent, 'locals' | 'url'>) {
	const user = requireUser(event);
	if (user.role !== 'client' || !user.customerId) error(403, 'Sem nemáte přístup.');
	return { ...user, customerId: user.customerId };
}
