// Structured client requests ("Požadavky"). Client-safe: used by the picker UI, server validation and admin rendering.
// Every request is carried out by hand by the team; these definitions only shape what the customer tells us.
import { z } from 'zod';
import type { ServiceKind, TicketCategory } from './constants';

export type FieldOption = { value: string; label: string };
export type FieldSpec = {
	name: string;
	label: string;
	type: 'text' | 'textarea' | 'select' | 'date' | 'datetime' | 'checkbox' | 'domain' | 'plan';
	options?: FieldOption[];
	required?: boolean;
	hint?: string;
	placeholder?: string;
	max?: number;
	mono?: boolean;
	defaultValue?: string;
	/** Show only when another field has one of these values. */
	showIf?: { field: string; values: string[] };
};

export type RequestDef = {
	key: TicketCategory;
	label: string;
	description: string;
	/** 'required' service must be one of the customer's own services; kinds limit which ones fit. */
	service: 'required' | 'optional' | 'none';
	serviceKinds?: readonly ServiceKind[];
	/** Free-text subject typed by the customer (general, billing). */
	ownSubject?: boolean;
	fields: FieldSpec[];
	bodyRequired: boolean;
	bodyLabel: string;
	bodyHint: string;
	urgent?: boolean;
};

export const RECORD_TYPES = ['A', 'AAAA', 'CNAME', 'MX', 'TXT'] as const;
export const PHP_VERSIONS = ['8.2', '8.3', '8.4', '8.5'] as const;
export const TTLS = [
	{ value: '300', label: '5 minut' },
	{ value: '3600', label: '1 hodina' },
	{ value: '86400', label: '1 den' }
] as const;

const WEB_KINDS = ['web', 'wp', 'app'] as const satisfies readonly ServiceKind[];
const HOSTED_KINDS = ['web', 'wp', 'app', 'vps', 'management'] as const satisfies readonly ServiceKind[];

export const REQUESTS: Record<TicketCategory, RequestDef> = {
	general: {
		key: 'general',
		label: 'Obecný dotaz',
		description: 'Cokoli, co se nevejde jinam. Napište vlastními slovy.',
		service: 'optional',
		ownSubject: true,
		fields: [],
		bodyRequired: true,
		bodyLabel: 'Zpráva',
		bodyHint: 'Co potřebujete, případně odkdy a na jaké adrese. Klidně vložte text chyby.'
	},
	dns: {
		key: 'dns',
		label: 'Změna DNS záznamu',
		description: 'Přidání, úprava nebo smazání záznamu A, AAAA, CNAME, MX nebo TXT.',
		service: 'none',
		fields: [
			{
				name: 'op',
				label: 'Co udělat',
				type: 'select',
				options: [
					{ value: 'add', label: 'Přidat záznam' },
					{ value: 'change', label: 'Změnit záznam' },
					{ value: 'delete', label: 'Smazat záznam' }
				],
				required: true,
				defaultValue: 'add'
			},
			{ name: 'domain', label: 'Doména', type: 'domain', required: true },
			{ name: 'type', label: 'Typ záznamu', type: 'select', options: RECORD_TYPES.map((t) => ({ value: t, label: t })), required: true, defaultValue: 'A' },
			{ name: 'name', label: 'Název (subdoména)', type: 'text', max: 63, mono: true, placeholder: 'www', hint: 'Prázdné nebo @ znamená samotnou doménu.' },
			{ name: 'value', label: 'Hodnota', type: 'text', max: 1000, mono: true, placeholder: '1.2.3.4', hint: 'IP adresa, cílový název nebo text záznamu. U smazání nepovinné.' },
			{ name: 'priority', label: 'Priorita MX', type: 'text', max: 5, mono: true, placeholder: '10', showIf: { field: 'type', values: ['MX'] } },
			{ name: 'ttl', label: 'TTL', type: 'select', options: [...TTLS], required: true, defaultValue: '3600' }
		],
		bodyRequired: false,
		bodyLabel: 'Poznámka',
		bodyHint: 'Nepovinné. Například kdy změnu provést nebo k čemu záznam slouží.'
	},
	database: {
		key: 'database',
		label: 'Nová databáze',
		description: 'Založíme MySQL databázi k vašemu webu a předáme přístup.',
		service: 'required',
		serviceKinds: WEB_KINDS,
		fields: [
			{
				name: 'dbName',
				label: 'Název databáze',
				type: 'text',
				required: true,
				max: 32,
				mono: true,
				placeholder: 'eshop',
				hint: 'Malá písmena, číslice a podtržítko. Před název doplníme prefix vašeho účtu.'
			}
		],
		bodyRequired: false,
		bodyLabel: 'Poznámka',
		bodyHint: 'Nepovinné. Třeba k čemu databáze bude.'
	},
	php: {
		key: 'php',
		label: 'Změna verze PHP',
		description: 'Přepneme web na jinou verzi PHP. Před změnou ověříme kompatibilitu.',
		service: 'required',
		serviceKinds: WEB_KINDS,
		fields: [{ name: 'version', label: 'Nová verze PHP', type: 'select', options: PHP_VERSIONS.map((v) => ({ value: v, label: `PHP ${v}` })), required: true, defaultValue: '8.4' }],
		bodyRequired: false,
		bodyLabel: 'Poznámka',
		bodyHint: 'Nepovinné. Například kdy se vám změna hodí.'
	},
	access: {
		key: 'access',
		label: 'Přístup SFTP / SSH',
		description: 'Nový přístup nebo váš veřejný SSH klíč. Hesla nikdy neposílejte.',
		service: 'required',
		serviceKinds: HOSTED_KINDS,
		fields: [
			{
				name: 'accessType',
				label: 'Typ přístupu',
				type: 'select',
				options: [
					{ value: 'sftp', label: 'SFTP (soubory)' },
					{ value: 'ssh', label: 'SSH (příkazová řádka)' }
				],
				required: true,
				defaultValue: 'sftp'
			},
			{
				name: 'sshKey',
				label: 'Veřejný SSH klíč',
				type: 'textarea',
				max: 16000,
				mono: true,
				placeholder: 'ssh-ed25519 AAAAC3Nza... jana@notebook',
				hint: 'Obsah souboru ~/.ssh/id_ed25519.pub. U SSH povinný. U SFTP bez klíče vám nové heslo předáme bezpečně, nikdy e-mailem.'
			}
		],
		bodyRequired: false,
		bodyLabel: 'Poznámka',
		bodyHint: 'Nepovinné. Nikdy sem nepište hesla.'
	},
	restore: {
		key: 'restore',
		label: 'Obnova ze zálohy',
		description: 'Vrátíme soubory nebo databázi do stavu k vybranému okamžiku.',
		service: 'required',
		serviceKinds: HOSTED_KINDS,
		fields: [
			{ name: 'point', label: 'Stav k okamžiku', type: 'datetime', required: true, hint: 'Obnovíme nejbližší starší zálohu.' },
			{
				name: 'what',
				label: 'Co obnovit',
				type: 'select',
				options: [
					{ value: 'files', label: 'Soubory' },
					{ value: 'db', label: 'Databázi' },
					{ value: 'both', label: 'Soubory i databázi' }
				],
				required: true,
				defaultValue: 'both'
			}
		],
		bodyRequired: false,
		bodyLabel: 'Poznámka',
		bodyHint: 'Co se stalo, případně které složky nebo tabulky. Obnova přepíše současný stav.'
	},
	change_plan: {
		key: 'change_plan',
		label: 'Změna tarifu',
		description: 'Přechod na vyšší nebo nižší tarif. Rozdíl v ceně dorovnáme na faktuře.',
		service: 'required',
		fields: [{ name: 'plan', label: 'Nový tarif', type: 'plan', required: true }],
		bodyRequired: false,
		bodyLabel: 'Poznámka',
		bodyHint: 'Nepovinné. Například od kdy změnu chcete.'
	},
	cancel: {
		key: 'cancel',
		label: 'Zrušení služby',
		description: 'Ukončení služby k vybranému datu. Před vypnutím vám ještě napíšeme.',
		service: 'required',
		fields: [
			{ name: 'date', label: 'Zrušit k datu', type: 'date', required: true, hint: 'Nejčastěji konec zaplaceného období.' },
			{ name: 'reason', label: 'Důvod', type: 'text', required: true, max: 300, placeholder: 'Například: web už nepotřebujeme' },
			{ name: 'confirm', label: 'Rozumím, že po zrušení data služby smažeme.', type: 'checkbox', required: true }
		],
		bodyRequired: false,
		bodyLabel: 'Poznámka',
		bodyHint: 'Nepovinné. Chcete před smazáním zálohu dat? Napište.'
	},
	billing: {
		key: 'billing',
		label: 'Fakturace',
		description: 'Dotaz k faktuře, platbě nebo změně fakturačních údajů.',
		service: 'optional',
		ownSubject: true,
		fields: [],
		bodyRequired: true,
		bodyLabel: 'Zpráva',
		bodyHint: 'Číslo faktury nebo variabilní symbol nám ušetří hledání.'
	},
	incident: {
		key: 'incident',
		label: 'Výpadek / porucha',
		description: 'Něco nefunguje. Řešíme přednostně. Při úplném výpadku raději i zavolejte.',
		service: 'required',
		fields: [],
		bodyRequired: true,
		bodyLabel: 'Co nefunguje',
		bodyHint: 'Co přesně se děje, odkdy a na jaké adrese. Klidně vložte text chyby.',
		urgent: true
	}
};

export const REQUEST_LIST = Object.values(REQUESTS);
export const categoryLabel = (c: string) => REQUESTS[c as TicketCategory]?.label ?? c;

export const REQUEST_LIMITS = { subject: 200, body: 8000 } as const;

const DOMAIN_RE = /^(?=.{3,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z][a-z0-9-]{1,62}$/;
const HOST_RE = /^(?=.{1,253}\.?$)(?:[a-z0-9_](?:[a-z0-9_-]{0,61}[a-z0-9])?\.)*[a-z0-9_](?:[a-z0-9_-]{0,61}[a-z0-9])?\.?$/i;
const IPV4_RE = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;
const IPV6_RE = /^[0-9a-f:]+(:[0-9.]+)?$/i;
const LABEL_RE = /^(@|\*|(\*\.)?[a-z0-9_](?:[a-z0-9_.-]{0,61}[a-z0-9])?)?$/i;
const SSH_KEY_RE =
	/^(ssh-ed25519|ssh-rsa|ecdsa-sha2-nistp(256|384|521)|sk-ssh-ed25519@openssh\.com|sk-ecdsa-sha2-nistp256@openssh\.com) AAAA[A-Za-z0-9+/]{20,}={0,3}( [^\r\n]{0,200})?$/;

/** True when the text is a single OpenSSH public key line. Private keys and passwords never match. */
export function isSshPublicKey(raw: string): boolean {
	const v = raw.trim();
	if (/PRIVATE KEY/i.test(v)) return false;
	return SSH_KEY_RE.test(v);
}

const str = (max: number) => z.string().trim().max(max, `Maximálně ${max} znaků.`);
const req = (max: number, msg: string) => str(max).min(1, msg);
const serviceId = z.preprocess((v) => (v === '' || v == null ? undefined : Number(v)), z.number().int().positive().optional());
const common = {
	service: serviceId,
	body: str(REQUEST_LIMITS.body).default('')
};

const pragueToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Prague' }).format(new Date());

export const REQUEST_SCHEMAS = {
	general: z.object({ ...common, subject: req(REQUEST_LIMITS.subject, 'Napište předmět.') }),
	billing: z.object({ ...common, subject: req(REQUEST_LIMITS.subject, 'Napište předmět.') }),
	incident: z.object(common),
	dns: z
		.object({
			...common,
			op: z.enum(['add', 'change', 'delete'], 'Vyberte, co udělat.'),
			domain: z.string().trim().toLowerCase().regex(DOMAIN_RE, 'Vyberte doménu.'),
			type: z.enum(RECORD_TYPES, 'Vyberte typ záznamu.'),
			name: z
				.string()
				.trim()
				.toLowerCase()
				.max(63, 'Maximálně 63 znaků.')
				.regex(LABEL_RE, 'Název smí obsahovat písmena, číslice, tečku, pomlčku a podtržítko.')
				.default(''),
			value: str(1000).default(''),
			priority: z.string().trim().regex(/^\d{0,5}$/, 'Priorita je číslo 0 až 65535.').default(''),
			ttl: z.enum(TTLS.map((t) => t.value) as [string, ...string[]], 'Vyberte TTL.')
		})
		.superRefine((v, ctx) => {
			if (v.op === 'delete' && !v.value) return;
			const bad = (message: string) => ctx.addIssue({ code: 'custom', path: ['value'], message });
			if (!v.value) return bad('Vyplňte hodnotu záznamu.');
			if (v.type === 'A' && !IPV4_RE.test(v.value)) bad('Záznam A potřebuje IPv4 adresu, např. 1.2.3.4.');
			if (v.type === 'AAAA' && !(IPV6_RE.test(v.value) && v.value.includes(':'))) bad('Záznam AAAA potřebuje IPv6 adresu.');
			if ((v.type === 'CNAME' || v.type === 'MX') && !HOST_RE.test(v.value)) bad('Zadejte název serveru, např. mail.firma.cz.');
			if (v.type === 'CNAME' && (v.name === '' || v.name === '@')) bad('CNAME nejde nastavit na samotnou doménu. Vyplňte subdoménu.');
			if (v.type === 'MX' && (v.priority === '' || Number(v.priority) > 65535))
				ctx.addIssue({ code: 'custom', path: ['priority'], message: 'Vyplňte prioritu 0 až 65535.' });
		}),
	database: z.object({
		...common,
		dbName: z
			.string()
			.trim()
			.toLowerCase()
			.regex(/^[a-z0-9_]{1,32}$/, 'Jen malá písmena, číslice a podtržítko, nejvýš 32 znaků.')
	}),
	php: z.object({ ...common, version: z.enum(PHP_VERSIONS, 'Vyberte verzi PHP.') }),
	access: z
		.object({
			...common,
			accessType: z.enum(['sftp', 'ssh'], 'Vyberte typ přístupu.'),
			sshKey: z
				.string()
				.trim()
				.max(16000, 'Klíč je příliš dlouhý.')
				.transform((v) => v.replace(/\s*\r?\n\s*/g, ' ').trim())
				.default('')
		})
		.superRefine((v, ctx) => {
			if (/PRIVATE KEY/i.test(v.sshKey))
				return ctx.addIssue({ code: 'custom', path: ['sshKey'], message: 'Tohle je soukromý klíč. Ten nikomu neposílejte, vložte jen veřejný (.pub).' });
			if (v.sshKey && !isSshPublicKey(v.sshKey))
				return ctx.addIssue({ code: 'custom', path: ['sshKey'], message: 'Nevypadá to jako veřejný SSH klíč (ssh-ed25519 AAAA... nebo ssh-rsa AAAA...).' });
			if (v.accessType === 'ssh' && !v.sshKey) ctx.addIssue({ code: 'custom', path: ['sshKey'], message: 'Pro SSH vložte svůj veřejný klíč.' });
		}),
	restore: z
		.object({
			...common,
			point: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, 'Vyberte datum a čas.'),
			what: z.enum(['files', 'db', 'both'], 'Vyberte, co obnovit.')
		})
		.superRefine((v, ctx) => {
			const day = v.point.slice(0, 10);
			if (day > pragueToday()) ctx.addIssue({ code: 'custom', path: ['point'], message: 'Okamžik nemůže být v budoucnosti.' });
		}),
	change_plan: z.object({ ...common, plan: req(40, 'Vyberte nový tarif.') }),
	cancel: z
		.object({
			...common,
			date: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, 'Vyberte datum.'),
			reason: req(300, 'Napište důvod.'),
			confirm: z.preprocess((v) => v === 'on' || v === 'true', z.literal(true, 'Potvrďte prosím zrušení.'))
		})
		.superRefine((v, ctx) => {
			if (v.date < pragueToday()) ctx.addIssue({ code: 'custom', path: ['date'], message: 'Datum nemůže být v minulosti.' });
		})
} satisfies Record<TicketCategory, z.ZodType>;

export type RequestData<C extends TicketCategory> = z.infer<(typeof REQUEST_SCHEMAS)[C]>;

const optionLabel = (def: RequestDef, field: string, value: string) =>
	def.fields.find((f) => f.name === field)?.options?.find((o) => o.value === value)?.label ?? value;

const czDate = (iso: string) => {
	const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
	return `${d}. ${m}. ${y}`;
};
const czDateTime = (iso: string) => `${czDate(iso)} ${iso.slice(11, 16)}`;

/** Fully qualified DNS name for a record label on a domain ("@" and empty mean the apex). */
export function dnsFqdn(name: string, domain: string): string {
	const n = name.replace(/\.$/, '');
	if (!n || n === '@') return domain;
	if (n === domain || n.endsWith(`.${domain}`)) return n;
	return `${n}.${domain}`;
}

/**
 * Turns validated form data into the stored details (display-ready strings keyed by field) and a subject.
 * `ctx` carries server-resolved labels (service, plan) so nothing client-supplied ends up unverified.
 */
export function buildRequest(
	category: TicketCategory,
	data: Record<string, unknown>,
	ctx: { serviceLabel?: string; planName?: string }
): { subject: string; details: Record<string, string> } {
	const def = REQUESTS[category];
	const d = data as Record<string, string>;
	const details: Record<string, string> = {};
	if (ctx.serviceLabel) details.service = ctx.serviceLabel;
	const svc = ctx.serviceLabel ?? '';
	let subject: string;
	switch (category) {
		case 'dns': {
			const fqdn = dnsFqdn(d.name, d.domain);
			Object.assign(details, { op: optionLabel(def, 'op', d.op), domain: d.domain, type: d.type, name: fqdn, ttl: optionLabel(def, 'ttl', d.ttl) });
			if (d.value) details.value = d.value;
			if (d.type === 'MX' && d.priority) details.priority = d.priority;
			subject =
				d.op === 'delete'
					? `DNS: smazat ${d.type} ${fqdn}${d.value ? ` (${d.value})` : ''}`
					: `DNS: ${d.op === 'change' ? 'změnit ' : ''}${d.type} ${fqdn} → ${d.type === 'MX' ? `${d.priority} ` : ''}${d.value}`;
			break;
		}
		case 'database':
			details.dbName = d.dbName;
			subject = `Nová databáze: ${d.dbName} (${svc})`;
			break;
		case 'php':
			details.version = `PHP ${d.version}`;
			subject = `PHP ${d.version}: ${svc}`;
			break;
		case 'access':
			details.accessType = optionLabel(def, 'accessType', d.accessType);
			details.sshKey = d.sshKey || 'Bez klíče, nové heslo předat bezpečně (ne e-mailem)';
			subject = `Přístup ${d.accessType.toUpperCase()}${d.sshKey ? ' (SSH klíč)' : ''}: ${svc}`;
			break;
		case 'restore':
			details.point = czDateTime(d.point);
			details.what = optionLabel(def, 'what', d.what);
			subject = `Obnova ze zálohy: ${optionLabel(def, 'what', d.what).toLowerCase()} k ${czDateTime(d.point)} (${svc})`;
			break;
		case 'change_plan':
			details.plan = `${ctx.planName ?? d.plan} (${d.plan})`;
			subject = `Změna tarifu: ${svc} → ${ctx.planName ?? d.plan}`;
			break;
		case 'cancel':
			details.date = czDate(d.date);
			details.reason = d.reason;
			subject = `Zrušení služby: ${svc} k ${czDate(d.date)}`;
			break;
		case 'incident': {
			const first = d.body.split(/\r?\n/)[0].trim();
			subject = `NALÉHAVÉ: výpadek ${svc}${first ? `: ${first}` : ''}`;
			break;
		}
		case 'billing':
			subject = `Fakturace: ${d.subject}`;
			break;
		default:
			subject = d.subject;
	}
	if (subject.length > REQUEST_LIMITS.subject) subject = `${subject.slice(0, REQUEST_LIMITS.subject - 1)}…`;
	return { subject, details };
}

const DETAIL_LABELS: Record<string, string> = {
	service: 'Služba',
	op: 'Akce',
	domain: 'Doména',
	type: 'Typ záznamu',
	name: 'Název',
	value: 'Hodnota',
	priority: 'Priorita MX',
	ttl: 'TTL',
	dbName: 'Název databáze',
	version: 'Verze PHP',
	accessType: 'Typ přístupu',
	sshKey: 'Veřejný SSH klíč',
	point: 'Stav k okamžiku',
	what: 'Co obnovit',
	plan: 'Nový tarif',
	date: 'Zrušit k datu',
	reason: 'Důvod'
};
const MONO = new Set(['domain', 'type', 'name', 'value', 'priority', 'dbName', 'sshKey']);

/** Rows for the details table in the client and admin ticket views. */
export function describeDetails(details: Record<string, string> | null | undefined): { key: string; label: string; value: string; mono: boolean }[] {
	if (!details) return [];
	// MySQL JSON does not keep key order, so rows follow the label table.
	const order = Object.keys(DETAIL_LABELS);
	const rank = (k: string) => (order.includes(k) ? order.indexOf(k) : order.length);
	return Object.entries(details)
		.filter(([, v]) => v !== '' && v != null)
		.sort(([a], [b]) => rank(a) - rank(b))
		.map(([key, value]) => ({ key, label: DETAIL_LABELS[key] ?? key, value: String(value), mono: MONO.has(key) }));
}

/** Plain-text summary of the details, for e-mails and as the first message when the note is empty. */
export const detailsText = (details: Record<string, string>) =>
	describeDetails(details)
		.map((r) => `${r.label}: ${r.value}`)
		.join('\n');
