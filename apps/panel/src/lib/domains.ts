import { z } from 'zod';

/**
 * Domain basket shared by the public order API, the client zone and the admin.
 * Pure on purpose (no node:url): the client zone validates the same way in the browser.
 */

// Price per year in CZK excl. VAT; null means "cenu potvrdíme".
// Same as "domains" in catalog/plans.json (domain-check.test.ts keeps them equal).
export const DOMAIN_PRICES: Readonly<Record<string, number | null>> = {
	cz: 249,
	eu: null,
	sk: null,
	com: null,
	net: null,
	org: null,
	online: null,
	store: null,
	tech: null
};

/** TLDs the search offers next to the one the customer typed. */
export const POPULAR_TLDS = ['cz', 'eu', 'sk', 'com'] as const;

/** Catalog plan for an order with domains only (category "domains", never a hosting service). */
export const DOMAIN_ONLY_PLAN = 'domeny';
export const MAX_BASKET = 20;

export type BasketMode = 'register' | 'transfer';
export interface BasketItem {
	name: string;
	mode: BasketMode;
	years: number;
}
/** What an order stores: the basket plus the price per year at the time of ordering. */
export interface OrderDomain extends BasketItem {
	price: number | null;
}

export const BASKET_MODE_LABEL: Record<BasketMode, string> = { register: 'Registrace', transfer: 'Převod' };

export type Normalized = { ok: true; ascii: string; name: string; tld: string } | { ok: false; reason: string };

const LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const TLD = /^(?:[a-z]{2,63}|xn--[a-z0-9-]{1,59})$/;

/** IDN to punycode through the WHATWG URL parser, which Node and browsers share. */
function toAscii(raw: string): string {
	try {
		return new URL(`http://${raw}/`).hostname;
	} catch {
		return '';
	}
}

/**
 * Strict check of a second-level domain such as firma.cz or kavárna.com.
 * `name` is the form the customer typed (lower case); the server swaps in the Unicode form of punycode input.
 */
export function normalizeDomainName(input: unknown): Normalized {
	const bad = (reason: string): Normalized => ({ ok: false, reason });
	if (typeof input !== 'string') return bad('Zadejte doménu, třeba firma.cz.');
	const raw = input.trim().toLowerCase().replace(/\.$/, '');
	if (!raw) return bad('Zadejte doménu, třeba firma.cz.');
	if (raw.length > 253 || /[\s/:@?#\\%]/.test(raw)) return bad('Zadejte jen samotnou doménu, třeba firma.cz.');
	const ascii = toAscii(raw);
	if (!ascii || ascii.length > 253) return bad('Tohle nevypadá jako doména. Zkuste třeba firma.cz.');
	const labels = ascii.split('.');
	if (labels.length !== 2) return bad('Zadejte doménu druhého řádu bez www, třeba firma.cz.');
	const [label, tld] = labels;
	if (!TLD.test(tld)) return bad('Neznámá koncovka domény.');
	if (!LABEL.test(label) || (label.slice(2, 4) === '--' && !label.startsWith('xn--')))
		return bad('Doména smí obsahovat písmena, číslice a pomlčky, ne na začátku ani na konci.');
	if (tld === 'cz' && ascii !== raw) return bad('Domény .cz nesmí obsahovat diakritiku.');
	return { ok: true, ascii, name: raw, tld };
}

/** Price per year for a domain, or null when we confirm it by e-mail. */
export function domainPrice(name: string): number | null {
	const tld = name.slice(name.lastIndexOf('.') + 1);
	return Object.hasOwn(DOMAIN_PRICES, tld) ? DOMAIN_PRICES[tld] : null;
}

/** Names to check for what the customer typed: their TLD first, then the popular ones. */
export function searchNames(input: string): string[] {
	const clean = input
		.trim()
		.toLowerCase()
		.replace(/^[a-z]+:\/\//, '')
		.replace(/[/?#].*$/, '')
		.replace(/^www\./, '')
		.replace(/\.$/, '');
	if (!clean) return [];
	const dot = clean.indexOf('.');
	const base = dot < 0 ? clean : clean.slice(0, dot);
	const typed = dot < 0 ? [] : [clean];
	return [...new Set([...typed, ...POPULAR_TLDS.map((t) => `${base}.${t}`)])];
}

export const yearsLabel = (n: number) => (n === 1 ? '1 rok' : `${n} roky`);

const item = z
	.object({
		name: z.string().max(253),
		mode: z.enum(['register', 'transfer'], 'Vyberte registraci, nebo převod.'),
		years: z.coerce.number().int().min(1, 'Doménu objednáte na 1 až 3 roky.').max(3, 'Doménu objednáte na 1 až 3 roky.').default(1)
	})
	.transform((v, ctx) => {
		const n = normalizeDomainName(v.name);
		if (!n.ok) {
			ctx.issues.push({ code: 'custom', input: v.name, message: `${v.name.slice(0, 80)}: ${n.reason}` });
			return z.NEVER;
		}
		return { name: n.name, ascii: n.ascii, mode: v.mode, years: v.years };
	});

/** The basket in an order body: valid names only, the first of duplicates wins, at most MAX_BASKET. */
export const domainBasketSchema = z
	.array(item)
	.max(MAX_BASKET, `V jedné objednávce může být nejvýš ${MAX_BASKET} domén.`)
	.default([])
	.transform((list): BasketItem[] => {
		const seen = new Set<string>();
		const out: BasketItem[] = [];
		for (const { name, ascii, mode, years } of list) {
			if (seen.has(ascii)) continue;
			seen.add(ascii);
			out.push({ name, mode, years });
		}
		return out;
	});

/** Basket items with the price snapshot an order stores. */
export const priced = (list: BasketItem[]): OrderDomain[] => list.map((d) => ({ ...d, price: domainPrice(d.name) }));

/** Known part of the basket price excl. VAT, and whether some price is still to be confirmed. */
export function basketTotal(list: OrderDomain[]): { known: number; unknown: number } {
	let known = 0;
	let unknown = 0;
	for (const d of list) {
		if (d.price == null) unknown++;
		else known += d.price * d.years;
	}
	return { known, unknown };
}

/** One line per domain for the order e-mails. */
export function basketLines(list: OrderDomain[]): string {
	return list
		.map((d) => `- ${d.name}, ${BASKET_MODE_LABEL[d.mode].toLowerCase()}, ${yearsLabel(d.years)}, ${d.price == null ? 'cenu potvrdíme' : `${d.price} Kč/rok`}`)
		.join('\n');
}
