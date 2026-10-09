import { createHash, randomBytes } from 'node:crypto';
import { WEDOS_DNS, WEDOS_NSSET, WEDOS_WAPI_LIVE, WEDOS_WAPI_PASSWORD, WEDOS_WAPI_USER } from '$app/env/private';

/**
 * WEDOS WAPI client (https://kb.wedos.global/wapi-manual/). Nothing here runs on its own: every call comes
 * from an admin button. Commands that change something are sent with `test: 1` (WEDOS only validates them)
 * unless WEDOS_WAPI_LIVE=1.
 */

export const WAPI_URL = 'https://api.wedos.com/wapi/json';
/** Public IP of the panel server; it must be whitelisted in WEDOS admin > WAPI. */
export const WAPI_SERVER_IP = '2.31.25.249';
const TIMEOUT_MS = 15_000;

export type WapiConfig = { user: string; password: string; live: boolean };

export const wedosConfig = (): WapiConfig => ({ user: WEDOS_WAPI_USER, password: WEDOS_WAPI_PASSWORD, live: WEDOS_WAPI_LIVE });

/** What the admin UI shows about the integration; never includes the password. */
export function wedosStatus(config = wedosConfig()) {
	const missing = [!config.user && 'WEDOS_WAPI_USER', !config.password && 'WEDOS_WAPI_PASSWORD'].filter((v): v is string => Boolean(v));
	return { configured: missing.length === 0, live: config.live, user: config.user, missing, serverIp: WAPI_SERVER_IP };
}
export type WedosStatus = ReturnType<typeof wedosStatus>;

/** Commands that only read; they never carry the test flag. */
const READ_ONLY = new Set(['ping', 'domain-check', 'domain-info', 'domains-list', 'contact-info', 'domain-transfer-check']);

const sha1 = (s: string) => createHash('sha1').update(s, 'utf8').digest('hex');

/** Current hour 00-23 in Europe/Prague, part of the WAPI auth hash. */
export function pragueHour(now = new Date()): string {
	const h = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Prague', hour: '2-digit', hourCycle: 'h23' }).format(now);
	return h.padStart(2, '0');
}

/** sha1(login + sha1(wapi_password) + HH). */
export const wapiAuth = (user: string, password: string, now = new Date()) => sha1(user + sha1(password) + pragueHour(now));

export const newClTRID = () => `srv-${Date.now()}-${randomBytes(3).toString('hex')}`;

export type WapiRequest = {
	request: { user: string; auth: string; command: string; clTRID: string; data?: Record<string, unknown>; test?: 1 };
};

/** Form body WAPI expects: `request=<urlencoded JSON>`. */
export const encodeRequest = (payload: WapiRequest) => new URLSearchParams({ request: JSON.stringify(payload) }).toString();

export type WapiResponse<T = Record<string, unknown>> = {
	code: number;
	result: string;
	clTRID?: string;
	svTRID?: string;
	command?: string;
	timestamp?: number;
	data?: T;
	/** True when WEDOS handled the request in test mode (nothing changed). */
	test: boolean;
};

const MESSAGES: Record<number, string> = {
	2050: 'Přihlášení k WAPI selhalo. Zkontrolujte WEDOS_WAPI_USER a WAPI heslo (ne heslo k účtu).',
	2051: `Přístup k WAPI z této IP adresy není povolený. Přidejte ${WAPI_SERVER_IP} v administraci WEDOS: WAPI > Povolené IP adresy.`,
	2052: 'IP adresa serveru je u WEDOS zablokovaná, obvykle po opakovaném chybném přihlášení. Zkontrolujte údaje a zkuste to později.',
	2006: 'Překročen limit WAPI (1000 požadavků za hodinu, 100 kontrol a registrací domén za hodinu). Zkuste to později.',
	2227: 'WEDOS odmítl formát telefonu. Zadejte ho ve tvaru +420 777000111.',
	2269: 'Prodloužení této domény už je u WEDOS zadané.',
	3002: 'Na účtu WEDOS není dostatek kreditu.',
	3201: 'Doména je už registrovaná.',
	3204: 'Doména je v karanténě, zatím ji nelze registrovat.',
	3205: 'Doména je rezervovaná.',
	3206: 'Doména je blokovaná.',
	3218: 'Doménu nelze převést (zkontrolujte stav domény a AUTH-ID).',
	3223: 'Doména není ve vašem účtu WEDOS.'
};

export const wapiMessage = (code: number, result = '') => MESSAGES[code] ?? `WEDOS vrátil chybu ${code}${result ? `: ${result}` : ''}.`;

export class WapiError extends Error {
	constructor(
		readonly code: number,
		readonly result: string,
		message = wapiMessage(code, result)
	) {
		super(message);
		this.name = 'WapiError';
	}
}

export type WapiOptions = {
	/** Force the test flag on or off; default: on for changing commands unless live. */
	test?: boolean;
	/** Response codes that are answers rather than errors (e.g. 3201 for domain-check). */
	accept?: number[];
	config?: WapiConfig;
	fetch?: typeof fetch;
};

export async function wapi<T = Record<string, unknown>>(command: string, data?: Record<string, unknown>, opts: WapiOptions = {}): Promise<WapiResponse<T>> {
	const config = opts.config ?? wedosConfig();
	if (!config.user || !config.password) throw new WapiError(0, '', 'WEDOS není nastavený (chybí WEDOS_WAPI_USER nebo WEDOS_WAPI_PASSWORD).');
	const test = READ_ONLY.has(command) ? false : (opts.test ?? !config.live);
	const request: WapiRequest['request'] = { user: config.user, auth: wapiAuth(config.user, config.password), command, clTRID: newClTRID() };
	if (data && Object.keys(data).length) request.data = data;
	if (test) request.test = 1;

	let raw: unknown;
	try {
		const res = await (opts.fetch ?? fetch)(WAPI_URL, {
			method: 'POST',
			headers: { 'content-type': 'application/x-www-form-urlencoded' },
			body: encodeRequest({ request }),
			signal: AbortSignal.timeout(TIMEOUT_MS)
		});
		if (!res.ok) throw new WapiError(0, `HTTP ${res.status}`, `WEDOS WAPI odpověděla HTTP ${res.status}.`);
		raw = await res.json();
	} catch (e) {
		if (e instanceof WapiError) throw e;
		const timeout = e instanceof Error && (e.name === 'TimeoutError' || e.name === 'AbortError');
		throw new WapiError(0, '', timeout ? 'WEDOS WAPI neodpověděla do 15 sekund.' : 'Spojení s WEDOS WAPI selhalo.');
	}

	const r = (raw as { response?: Record<string, unknown> } | null)?.response;
	if (!r || r.code == null) throw new WapiError(0, '', 'WEDOS WAPI vrátila nečitelnou odpověď.');
	const code = Number(r.code);
	const result = String(r.result ?? '');
	if (code !== 1000 && code !== 1001 && !opts.accept?.includes(code)) throw new WapiError(code, result);
	return {
		code,
		result,
		clTRID: r.clTRID as string | undefined,
		svTRID: r.svTRID as string | undefined,
		command: r.command as string | undefined,
		timestamp: r.timestamp as number | undefined,
		data: r.data as T | undefined,
		test: test || Number(r.test ?? 0) === 1
	};
}

/** Outcome of a changing command, as the admin sees it. */
export type WapiChange<T = Record<string, unknown>> = { code: number; result: string; test: boolean; pending: boolean; data: T | undefined };
const change = <T>(r: WapiResponse<T>): WapiChange<T> => ({ code: r.code, result: r.result, test: r.test, pending: r.code === 1001, data: r.data });

/** WAPI dates come as YYYY-MM-DD (sometimes with time); returns YYYY-MM-DD or null. */
export function wapiDate(v: unknown): string | null {
	if (typeof v === 'number' && v > 0) return new Date(v * 1000).toISOString().slice(0, 10);
	if (typeof v !== 'string') return null;
	const m = /^(\d{4}-\d{2}-\d{2})/.exec(v.trim());
	return m ? m[1] : null;
}

export const tldOf = (name: string) => name.toLowerCase().split('.').pop() ?? '';

// --- nameservers -------------------------------------------------------------------------------------------

/** `dns` payload: { server1: { name }, server2: { name }, ... }. */
export const dnsPayload = (servers: string[]) => Object.fromEntries(servers.slice(0, 4).map((name, i) => [`server${i + 1}`, { name, addr_ipv4: '', addr_ipv6: '' }]));

/** NSSET for .cz when configured, otherwise the WEDOS_DNS list, otherwise nothing (WEDOS defaults). */
export function nameservers(name: string, nsset = WEDOS_NSSET, dns: string[] = WEDOS_DNS): { nsset: string } | { dns: Record<string, unknown> } | Record<string, never> {
	if (tldOf(name) === 'cz' && nsset) return { nsset };
	if (dns.length) return { dns: dnsPayload(dns) };
	return {};
}

// --- contacts ---------------------------------------------------------------------------------------------

/**
 * The single phone format sent to WEDOS: "+420 777000111" (country code, space, digits).
 * Returns '' for an empty input and null when the number cannot be understood.
 */
export function normalisePhone(raw: string): string | null {
	const s = raw.trim();
	if (!s) return '';
	// keep an explicit split after the country code ("+49 301234", "+49.301234")
	const split = /^(?:\+|00)(\d{1,3})[\s.]+(.+)$/.exec(s);
	let cc: string;
	let rest: string;
	if (split) {
		cc = split[1];
		rest = split[2];
	} else {
		const digits = s.replace(/[\s.()/-]/g, '');
		const intl = /^(?:\+|00)(\d+)$/.exec(digits);
		if (intl) {
			const m = /^(420|421)(\d+)$/.exec(intl[1]);
			if (!m) return null;
			cc = m[1];
			rest = m[2];
		} else if (/^\d{9}$/.test(digits)) {
			cc = '420';
			rest = digits;
		} else return null;
	}
	rest = rest.replace(/[\s.()/-]/g, '');
	if (!/^\d{4,14}$/.test(rest)) return null;
	if ((cc === '420' || cc === '421') && rest.length !== 9) return null;
	return `+${cc} ${rest}`;
}

export type WapiContact = {
	fname: string;
	lname: string;
	company: string;
	addr_street: string;
	addr_city: string;
	addr_zip: string;
	addr_country: string;
	phone: string;
	email: string;
	notify_email: string;
	ident_type: '' | 'ico' | 'op' | 'birthday' | 'passport' | 'mpsv';
	ident: string;
	dic: string;
};

/** Best-effort split of the single customer address line "Ulice 12, 301 00 Plzeň". */
export function splitAddress(address: string): { street: string; city: string; zip: string } {
	const parts = address.split(',').map((p) => p.trim()).filter(Boolean);
	const zipRe = /(\d{3})\s?(\d{2})\b/;
	const zipIdx = parts.findIndex((p) => zipRe.test(p));
	if (zipIdx === -1) return { street: parts[0] ?? '', city: parts.slice(1).join(', '), zip: '' };
	const m = zipRe.exec(parts[zipIdx])!;
	const zip = m[1] + m[2];
	let city = parts[zipIdx].replace(m[0], '').trim();
	const others = parts.filter((_, i) => i !== zipIdx);
	if (!city) city = others.length > 1 ? others[others.length - 1] : '';
	const street = others.filter((p) => p !== city).join(', ');
	return { street, city, zip };
}

type CustomerLike = { name: string; company: string; ico: string; dic: string; address: string; email: string; phone: string };

/** Contact payload prefilled from the customer record; the admin reviews and edits it before sending. */
export function contactFromCustomer(c: CustomerLike): WapiContact {
	const words = c.name.trim().split(/\s+/);
	const lname = words.length > 1 ? words.pop()! : '';
	const addr = splitAddress(c.address);
	return {
		fname: words.join(' '),
		lname,
		company: c.company,
		addr_street: addr.street,
		addr_city: addr.city,
		addr_zip: addr.zip,
		addr_country: 'cz',
		phone: normalisePhone(c.phone) ?? c.phone,
		email: c.email,
		notify_email: c.email,
		ident_type: c.ico ? 'ico' : '',
		ident: c.ico,
		dic: c.dic
	};
}

/** Drops empty optional fields so WEDOS does not validate blanks. */
export function contactPayload(c: WapiContact): Record<string, string> {
	return Object.fromEntries(Object.entries({ ...c, addr_country: c.addr_country.toLowerCase() }).filter(([, v]) => v !== ''));
}

// --- helpers ---------------------------------------------------------------------------------------------

export type Rules = { fname: string; lname: string };

/** Splits an admin's display name into WEDOS `rules` (who accepted the registry rules). */
export function rulesFromName(name: string): Rules {
	const words = name.trim().split(/\s+/);
	const lname = words.length > 1 ? words.pop()! : words[0] ?? '';
	return { fname: words.join(' ') || lname, lname };
}

export const ping = (opts?: WapiOptions) => wapi('ping', undefined, opts);

const CHECK_CODES = [3201, 3204, 3205, 3206];
export async function checkDomain(name: string, opts?: WapiOptions) {
	const r = await wapi('domain-check', { name }, { ...opts, accept: CHECK_CODES });
	return { available: r.code === 1000, code: r.code, message: r.code === 1000 ? 'Doména je volná.' : wapiMessage(r.code, r.result) };
}

export type DomainInfo = { name: string; status: string; owner_c?: string; nsset?: string; dns?: unknown; expiration?: string; setup_date?: string };
export async function domainInfo(name: string, opts?: WapiOptions) {
	const r = await wapi<{ domain?: DomainInfo }>('domain-info', { name }, opts);
	const d = r.data?.domain;
	if (!d) throw new WapiError(r.code, r.result, 'WEDOS nevrátil údaje o doméně.');
	return { ...d, expiration: wapiDate(d.expiration) ?? undefined };
}

export type CreateDomain = { name: string; period: number; ownerC: string; adminC?: string; rules: Rules; nsset?: string; dns?: string[] };
export async function createDomain(p: CreateDomain, opts?: WapiOptions) {
	const ns = nameservers(p.name, p.nsset ?? WEDOS_NSSET, p.dns ?? WEDOS_DNS);
	const data: Record<string, unknown> = { name: p.name, period: p.period, owner_c: p.ownerC, ...ns, rules: p.rules };
	if (p.adminC) data.admin_c = p.adminC;
	const r = change(await wapi<{ num?: string; expiration?: string; credit?: string }>('domain-create', data, opts));
	return { ...r, expiration: wapiDate(r.data?.expiration) };
}

export async function renewDomain(name: string, years: number, opts?: WapiOptions) {
	const r = change(await wapi<{ expiration?: string }>('domain-renew', { name, period: years }, opts));
	return { ...r, expiration: wapiDate(r.data?.expiration) };
}

export async function transferCheck(name: string, opts?: WapiOptions) {
	const r = await wapi('domain-transfer-check', { name }, { ...opts, accept: [3218] });
	return { possible: r.code === 1000, code: r.code, message: r.code === 1000 ? 'Převod je možný.' : wapiMessage(r.code, r.result) };
}

export type TransferDomain = { name: string; authInfo: string; ownerC?: string; rules: Rules };
export async function transferDomain(p: TransferDomain, opts?: WapiOptions) {
	const data: Record<string, unknown> = { name: p.name, auth_info: p.authInfo, rules: p.rules };
	if (p.ownerC) data.owner_c = p.ownerC;
	const r = change(await wapi<{ num?: string; expiration?: string }>('domain-transfer', data, opts));
	return { ...r, expiration: wapiDate(r.data?.expiration) };
}

/** WAPI returns the list as an array or as an object keyed by index; both are accepted. */
export async function listDomains(status?: string, opts?: WapiOptions) {
	const r = await wapi<{ domain?: unknown }>('domains-list', status ? { status } : undefined, opts);
	const raw = r.data?.domain;
	const items = Array.isArray(raw) ? raw : raw && typeof raw === 'object' ? Object.values(raw) : [];
	return items
		.filter((d): d is { name: string; status?: string } => Boolean(d) && typeof (d as { name?: unknown }).name === 'string')
		.map((d) => ({ name: d.name.toLowerCase(), status: String(d.status ?? '') }));
}

export async function createContact(tld: string, contact: WapiContact, opts?: WapiOptions) {
	const r = change(await wapi<{ cname?: string }>('contact-create', { tld, contact: contactPayload(contact) }, opts));
	return { ...r, cname: r.data?.cname ?? null };
}

export const contactInfo = (tld: string, cname: string, opts?: WapiOptions) => wapi('contact-info', { tld, cname }, opts);

export const sendAuthInfo = async (name: string, opts?: WapiOptions) => change(await wapi('domain-send-auth-info', { name }, opts));

export async function updateNs(name: string, ns: { nsset: string } | { dns: string[] }, opts?: WapiOptions) {
	const data = 'nsset' in ns ? { name, nsset: ns.nsset } : { name, dns: dnsPayload(ns.dns) };
	return change(await wapi('domain-update-ns', data, opts));
}

/** Domains at WEDOS but not in the panel, and panel domains marked WEDOS that WEDOS does not know. */
export function compareDomains(wedos: { name: string; status: string }[], panel: { id: number; name: string; registrar: string }[]) {
	const atWedos = new Set(wedos.map((d) => d.name.toLowerCase()));
	const inPanel = new Set(panel.map((d) => d.name.toLowerCase()));
	return {
		onlyWedos: wedos.filter((d) => !inPanel.has(d.name.toLowerCase())),
		missingAtWedos: panel.filter((d) => d.registrar.trim().toLowerCase() === 'wedos' && !atWedos.has(d.name.toLowerCase())),
		matched: wedos.length - wedos.filter((d) => !inPanel.has(d.name.toLowerCase())).length
	};
}
