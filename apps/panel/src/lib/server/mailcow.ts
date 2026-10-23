import { z } from 'zod';
import { MAILCOW_API_KEY, MAILCOW_API_URL, MAILCOW_WEB_URL, MAILCOW_OUTBOUND_READY } from '$app/env/private';

export type MailcowConfig = { url: string; key: string };
export const mailcowConfig = (): MailcowConfig => ({ url: MAILCOW_API_URL, key: MAILCOW_API_KEY });
export class MailcowError extends Error {}

/** Return only public configuration. Never serialize the API key or internal API URL. */
export function mailcowStatus(config = mailcowConfig()) {
	let webUrl = '';
	try { if (new URL(MAILCOW_WEB_URL).protocol === 'https:') webUrl = new URL(MAILCOW_WEB_URL).origin; } catch { /* not configured */ }
	return { configured: Boolean(config.url && config.key), webUrl, outboundReady: MAILCOW_OUTBOUND_READY === '1' };
}

type Options = { config?: MailcowConfig; fetch?: typeof fetch };
const record = z.record(z.string(), z.unknown());

/** No redirects: a redirect must never forward the API key to a different host. */
export async function mailcowRequest(path: string, body?: unknown, opts: Options = {}): Promise<unknown> {
	const config = opts.config ?? mailcowConfig();
	if (!config.url || !config.key) throw new MailcowError('Mailcow není připojený. Správce musí nastavit přístup k API.');
	let origin: URL;
	try {
		origin = new URL(config.url);
		if (origin.username || origin.password || origin.search || origin.hash || origin.pathname !== '/') throw new Error();
		if (origin.protocol !== 'https:' && !(origin.protocol === 'http:' && origin.hostname === '127.0.0.1')) throw new Error();
	} catch { throw new MailcowError('Adresa API musí používat HTTPS nebo místní SSH tunel na 127.0.0.1.'); }
	if (!/^(get|add|edit)\/[a-z-]+(?:\/[a-zA-Z0-9@._%+-]+)?$/.test(path)) throw new MailcowError('Nepovolená operace Mailcow.');
	let raw: unknown;
	try {
		const response = await (opts.fetch ?? fetch)(new URL('/api/v1/' + path, origin), {
			method: body === undefined ? 'GET' : 'POST',
			headers: { 'X-API-Key': config.key, 'Content-Type': 'application/json' },
			body: body === undefined ? undefined : JSON.stringify(body),
			redirect: 'error', signal: AbortSignal.timeout(15_000)
		});
		if (!response.ok) throw new MailcowError(`Mailcow API odpovědělo HTTP ${response.status}. Zkontrolujte spojení, API klíč a povolenou IP.`);
		raw = await response.json();
	} catch (e) {
		if (e instanceof MailcowError) throw e;
		throw new MailcowError('Spojení s Mailcow API selhalo nebo neodpovědělo do 15 sekund.');
	}
	// Mailcow also reports failed mutations with HTTP 200. Raw errors may echo
	// request bodies (including passwords), so none of them reaches logs or UI.
	const results = Array.isArray(raw) ? raw : [raw];
	if (body !== undefined || results.some((r) => record.safeParse(r).success && ['error', 'danger'].includes(String((r as Record<string, unknown>).type)))) {
		if (!results.length || results.some((r) => !record.safeParse(r).success || (r as Record<string, unknown>).type !== 'success'))
			throw new MailcowError('Mailcow změnu odmítl. Zkontrolujte duplicitu adresy, sílu hesla a dostupnou kvótu.');
	}
	return raw;
}

const rows = (raw: unknown): Record<string, unknown>[] => {
	if (raw && typeof raw === 'object' && !Array.isArray(raw) && Object.keys(raw).length === 0) return [];
	const result = z.array(record).safeParse(raw);
	if (!result.success) throw new MailcowError('Mailcow vrátil neplatný seznam.');
	return result.data;
};
const n = (v: unknown) => Number.isFinite(Number(v)) ? Number(v) : 0;
const active = (v: unknown) => v === true || v === 1 || v === '1';

/** Whitelist fields: mailbox API responses contain internal configuration too. */
export async function mailcowSnapshot(opts: Options = {}) {
	const [domains, mailboxes, aliases] = await Promise.all([
		mailcowRequest('get/domain/all', undefined, opts), mailcowRequest('get/mailbox/all', undefined, opts), mailcowRequest('get/alias/all', undefined, opts)
	]);
	return {
		domains: rows(domains).map((r) => ({ domain: String(r.domain_name ?? r.domain ?? ''), description: String(r.description ?? ''), active: active(r.active), quotaMiB: r.max_quota_for_domain == null ? n(r.quota) : n(r.max_quota_for_domain) / 1048576, maxMailboxMiB: r.max_quota_for_mbox == null ? n(r.maxquota) : n(r.max_quota_for_mbox) / 1048576, mailboxes: n(r.mboxes_in_domain), mailboxLimit: n(r.max_num_mboxes_for_domain ?? r.mailboxes) })),
		mailboxes: rows(mailboxes).map((r) => ({ address: String(r.username ?? ''), domain: String(r.domain ?? ''), name: String(r.name ?? ''), active: active(r.active), quotaBytes: n(r.quota), usedBytes: n(r.quota_used), messages: n(r.messages) })),
		aliases: rows(aliases).filter((r) => r.address !== r.goto).map((r) => ({ address: String(r.address ?? ''), destination: String(r.goto ?? ''), active: active(r.active) }))
	};
}

export const mailDomain = z.string().trim().toLowerCase().max(253).regex(/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/, 'Zadejte platnou doménu.');
export const localPart = z.string().trim().toLowerCase().max(64).regex(/^[a-z0-9](?:[a-z0-9._+-]*[a-z0-9])?$/, 'Neplatná část adresy před zavináčem.').refine((v) => !v.includes('..'), 'Adresa nesmí obsahovat dvě tečky za sebou.');
export const mailboxAddress = z.email().max(254).transform((v) => v.toLowerCase());
export const mailboxPassword = z.string().min(12, 'Heslo musí mít alespoň 12 znaků.').max(128);
export const mailboxQuota = z.coerce.number().int().min(16).max(2048);

export async function createMailDomain(input: { domain: string; description: string; quota: number }, opts: Options = {}) {
	const domain = mailDomain.parse(input.domain);
	const quota = z.number().int().min(512).max(8192).parse(input.quota);
	return mailcowRequest('add/domain', { domain, description: input.description.slice(0, 100), active: '1', aliases: 50, mailboxes: 10, quota, maxquota: Math.min(quota, 2048), defquota: 512, backupmx: '0', relay_all_recipients: '0', gal: '0', restart_sogo: '1', rl_value: 200, rl_frame: 'h' }, opts);
}
export async function createMailMailbox(input: { domain: string; localPart: string; name: string; password: string; quota: number }, opts: Options = {}) {
	return mailcowRequest('add/mailbox', { domain: mailDomain.parse(input.domain), local_part: localPart.parse(input.localPart), name: input.name.slice(0, 100), password: mailboxPassword.parse(input.password), password2: input.password, quota: mailboxQuota.parse(input.quota), active: '1', authsource: 'mailcow', force_pw_update: '0', tls_enforce_in: '0', tls_enforce_out: '0' }, opts);
}
export async function updateMailMailbox(address: string, changes: { active?: boolean; password?: string; quota?: number }, opts: Options = {}) {
	const attr: Record<string, unknown> = {};
	if (changes.active !== undefined) attr.active = changes.active ? '1' : '0';
	if (changes.password !== undefined) { attr.password = mailboxPassword.parse(changes.password); attr.password2 = attr.password; }
	if (changes.quota !== undefined) attr.quota = mailboxQuota.parse(changes.quota);
	if (!Object.keys(attr).length) throw new MailcowError('Chybí požadovaná změna.');
	return mailcowRequest('edit/mailbox', { items: [mailboxAddress.parse(address)], attr }, opts);
}
export async function createMailAlias(address: string, destination: string, opts: Options = {}) {
	return mailcowRequest('add/alias', { address: mailboxAddress.parse(address), goto: mailboxAddress.parse(destination), active: '1' }, opts);
}

export async function mailDomainDns(domain: string, opts: Options = {}) {
	const name = mailDomain.parse(domain);
	const raw = record.parse(await mailcowRequest('get/dkim/' + encodeURIComponent(name), undefined, opts));
	return { domain: name, selector: String(raw.dkim_selector ?? 'dkim'), dkim: String(raw.dkim_txt ?? '') };
}
