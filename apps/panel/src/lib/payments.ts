// Pure helpers for payment requests (zálohové výzvy). Shared by server code and tests.

/** Gross amount from a net price and a VAT percent, rounded to whole crowns. */
export const withVat = (net: number, vatRate: number) => Math.round((net * (100 + vatRate)) / 100);

/** Variable symbol: two-digit year plus the request id, e.g. 26000042. Fits SPAYD's 10 digits. */
export const variableSymbol = (id: number, year = new Date().getFullYear()) =>
	String(year % 100).padStart(2, '0') + String(id).padStart(6, '0');

function mod97(digits: string): number {
	let rest = 0;
	for (const ch of digits) rest = (rest * 10 + Number(ch)) % 97;
	return rest;
}

/** Converts a Czech account ("19-2000145399/0800" or "2000145399/0800") to an IBAN, or null if malformed. */
export function czechIban(account: string): string | null {
	const m = /^(?:(\d{1,6})-)?(\d{2,10})\/(\d{4})$/.exec(account.trim());
	if (!m) return null;
	const bban = m[3] + (m[1] ?? '').padStart(6, '0') + m[2].padStart(10, '0');
	// "CZ" = 12 35, check digits computed with "00" placeholder.
	const check = String(98 - mod97(bban + '123500')).padStart(2, '0');
	return `CZ${check}${bban}`;
}

export const ibanValid = (iban: string) => {
	const s = iban.replace(/\s/g, '').toUpperCase();
	if (!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(s)) return false;
	const moved = s.slice(4) + s.slice(0, 4);
	const digits = moved.replace(/[A-Z]/g, (c) => String(c.charCodeAt(0) - 55));
	return mod97(digits) === 1;
};

const ascii = (s: string) =>
	s
		.normalize('NFD')
		.replace(/\p{Diacritic}/gu, '')
		.replace(/[^A-Za-z0-9 .,/-]/g, '')
		.toUpperCase();

/** Czech QR payment string (SPAYD 1.0), understood by every Czech banking app. */
export function spayd(o: { iban: string; amount: number; vs: string; message: string; dueDate?: string }) {
	const parts = [
		'SPD*1.0',
		`ACC:${o.iban.replace(/\s/g, '')}`,
		`AM:${o.amount.toFixed(2)}`,
		'CC:CZK',
		`X-VS:${o.vs}`,
		`MSG:${ascii(o.message).slice(0, 60)}`
	];
	if (o.dueDate) parts.push(`DT:${o.dueDate.replace(/-/g, '')}`);
	return parts.join('*');
}

const iso = (d: Date) => d.toISOString().slice(0, 10);

/**
 * Date a paid renewal extends the service to. Renewing early stacks on the current expiry;
 * renewing late starts from today so the customer is not charged for the gap.
 */
export function nextCoverage(expiresAt: string | null, period: 'month' | 'year', today = new Date()): string {
	const todayIso = iso(today);
	const start = expiresAt && expiresAt >= todayIso ? new Date(expiresAt + 'T00:00:00Z') : new Date(todayIso + 'T00:00:00Z');
	const end = new Date(start);
	if (period === 'year') end.setUTCFullYear(end.getUTCFullYear() + 1);
	else end.setUTCMonth(end.getUTCMonth() + 1);
	// Expiry is the last valid day, so a renewal from today ends the day before the anniversary.
	if (!(expiresAt && expiresAt >= todayIso)) end.setUTCDate(end.getUTCDate() - 1);
	return iso(end);
}

export const PAYMENT_STATUS_LABEL = { unpaid: 'K úhradě', paid: 'Zaplaceno', cancelled: 'Zrušeno' } as const;
