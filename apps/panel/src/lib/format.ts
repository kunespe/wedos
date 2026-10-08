const TZ = 'Europe/Prague';

const money = new Intl.NumberFormat('cs-CZ', { maximumFractionDigits: 0 });
export const czk = (n: number | null | undefined) => (n == null ? 'Individuálně' : `${money.format(n)} Kč`);

/** Yearly billing charges this many months. Keep in sync with catalog/plans.json. */
export const YEARLY_MONTHS = 10;
export const periodTotal = (monthly: number, period: 'month' | 'year') =>
	period === 'year' ? monthly * YEARLY_MONTHS : monthly;

const dateFmt = new Intl.DateTimeFormat('cs-CZ', { timeZone: TZ, day: 'numeric', month: 'numeric', year: 'numeric' });
const dateTimeFmt = new Intl.DateTimeFormat('cs-CZ', {
	timeZone: TZ,
	day: 'numeric',
	month: 'numeric',
	year: 'numeric',
	hour: '2-digit',
	minute: '2-digit'
});
const asDate = (v: Date | string | number) => (v instanceof Date ? v : new Date(typeof v === 'number' && v < 1e12 ? v * 1000 : v));

export const date = (v: Date | string | number | null | undefined) => (v == null || v === '' ? 'Bez data' : dateFmt.format(asDate(v)));
export const dateTime = (v: Date | string | number | null | undefined) => (v == null ? '' : dateTimeFmt.format(asDate(v)));

const rtf = new Intl.RelativeTimeFormat('cs-CZ', { numeric: 'auto' });
export function ago(v: Date | string | number): string {
	const seconds = (asDate(v).getTime() - Date.now()) / 1000;
	const steps: [Intl.RelativeTimeFormatUnit, number][] = [
		['second', 60],
		['minute', 60],
		['hour', 24],
		['day', 30],
		['month', 12],
		['year', Infinity]
	];
	let value = seconds;
	for (const [unit, size] of steps) {
		if (Math.abs(value) < size) return rtf.format(Math.round(value), unit);
		value /= size;
	}
	return '';
}

/** Whole days from today (Prague) until an ISO date; negative when past. */
export function daysUntil(iso: string | null | undefined): number | null {
	if (!iso) return null;
	const today = new Date(new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date()));
	return Math.round((new Date(iso).getTime() - today.getTime()) / 86_400_000);
}

export function bytes(n: number): string {
	if (n >= 1024 ** 3) return `${(n / 1024 ** 3).toFixed(1).replace('.', ',')} GB`;
	return `${Math.round(n / 1024 ** 2)} MB`;
}

export const KIND_LABEL: Record<string, string> = {
	web: 'Webhosting',
	wp: 'WordPress',
	app: 'Aplikace',
	vps: 'VPS',
	management: 'Správa serverů',
	domain: 'Doména'
};

export const SERVICE_STATUS_LABEL: Record<string, string> = {
	pending: 'Zřizujeme',
	active: 'Běží',
	suspended: 'Pozastaveno',
	cancelled: 'Zrušeno'
};

export const TICKET_STATUS_LABEL: Record<string, string> = {
	open: 'Otevřený',
	waiting: 'Čeká na vás',
	closed: 'Uzavřený'
};
