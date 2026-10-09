// Client-safe labels and helpers for the server operation pages (broker data).

/** Labels for broker audit events (dashboard/broker.py audit()). */
export const BROKER_EVENT_LABEL: Record<string, string> = {
	site_create: 'Založení webu',
	site_create_failed: 'Založení webu selhalo',
	cloudpanel_login: 'Vstup do CloudPanelu',
	hosting_settings: 'Nastavení hostingu',
	wordpress_settings: 'Plán WordPressu',
	wordpress_run: 'Údržba WordPressu',
	error: 'Chyba operace',
	web_suspend: 'Pozastavení webu',
	web_resume: 'Obnovení webu',
	update_check: 'Kontrola aktualizací',
	billing_sync: 'Kontrola Fakturoru'
};

/** Site kinds the broker can create (broker.py create()). */
export const SITE_KINDS = ['wordpress', 'php', 'static', 'nodejs', 'bun'] as const;
export type SiteKind = (typeof SITE_KINDS)[number];

export const SITE_KIND_LABEL: Record<string, string> = {
	wordpress: 'WordPress',
	php: 'PHP',
	static: 'Statický web',
	nodejs: 'Node.js',
	bun: 'Bun',
	'reverse-proxy': 'Reverse proxy'
};

/** Kinds the broker refuses to suspend: their process has to be stopped in CloudPanel. */
export const isApp = (kind: string) => ['bun', 'nodejs', 'node.js', 'reverse proxy', 'reverse-proxy'].includes(kind.toLowerCase());

/** systemd `is-active` output to an LED state. */
export const unitTone = (state: string): 'ok' | 'act' | 'bad' => (state === 'active' ? 'ok' : state === 'activating' || state === 'reloading' ? 'act' : 'bad');

export const UNIT_LABEL: Record<string, string> = {
	active: 'Běží',
	activating: 'Startuje',
	reloading: 'Načítá',
	inactive: 'Neběží',
	failed: 'Selhala',
	deactivating: 'Zastavuje'
};

/** Valid domain as the broker accepts it (broker.py DOMAIN). */
export const DOMAIN_RE = /^(?=.{3,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z][a-z0-9-]{1,62}$/;

export const pct = (n: number) => `${Math.round(n * 100)} %`;
export const meterTone = (n: number) => (n > 0.9 ? 'bg-bad' : n > 0.75 ? 'bg-amber' : 'bg-led');

/** Uptime in seconds to "3 d 2 h". */
export function duration(seconds: number) {
	const d = Math.floor(seconds / 86400);
	const h = Math.floor((seconds % 86400) / 3600);
	const m = Math.floor((seconds % 3600) / 60);
	return d ? `${d} d ${h} h` : h ? `${h} h ${m} min` : `${m} min`;
}
