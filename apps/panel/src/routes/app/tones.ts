import { daysUntil } from '#lib/format.ts';

export type Tone = 'ok' | 'act' | 'warn' | 'bad' | 'off';

export const SERVICE_TONE: Record<string, Tone> = {
	pending: 'act',
	active: 'ok',
	suspended: 'warn',
	cancelled: 'off'
};

export const TICKET_TONE: Record<string, Tone> = {
	open: 'act',
	waiting: 'warn',
	closed: 'off'
};

/** Expiry tone: past is bad, within `soon` days is a warning. */
export function expiryTone(iso: string | null | undefined, soon = 30): Tone {
	const d = daysUntil(iso);
	if (d == null) return 'off';
	if (d < 0) return 'bad';
	if (d <= soon) return 'warn';
	return 'ok';
}

export function expiryHint(iso: string | null | undefined): string {
	const d = daysUntil(iso);
	if (d == null) return '';
	if (d < 0) return `vypršelo před ${-d} ${d === -1 ? 'dnem' : 'dny'}`;
	if (d === 0) return 'vyprší dnes';
	if (d === 1) return 'vyprší zítra';
	return `za ${d} ${d < 5 ? 'dny' : 'dní'}`;
}

export const TEXT_TONE: Record<Tone, string> = {
	ok: 'text-muted',
	act: 'text-muted',
	warn: 'text-warn',
	bad: 'text-bad',
	off: 'text-muted'
};

export const CONTACT = { email: 'info@serveros.cz', phone: '+420 773 559 645', tel: '+420773559645' };
