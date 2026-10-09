import { domainToUnicode } from 'node:url';
import { DOMAIN_PRICES, domainPrice, normalizeDomainName, type Normalized } from '../domains.ts';

/**
 * Domain availability over RDAP, for the public search on serveros.cz.
 * .cz goes straight to CZ.NIC, other TLDs through the IANA bootstrap file.
 * RDAP answers 404 for a name nobody holds and 200 for a registered one;
 * anything else is "we do not know", never a guess.
 */

// Same as "domains.cz" and extras "domena-cz" in catalog/plans.json (domain-check.test.ts keeps them equal).
export const CZ_DOMAIN_PRICE = DOMAIN_PRICES.cz as number;

const CZ_RDAP = 'https://rdap.nic.cz/';
const BOOTSTRAP_URL = 'https://data.iana.org/rdap/dns.json';
const BOOTSTRAP_TTL = 24 * 60 * 60 * 1000;
const RESULT_TTL = 10 * 60 * 1000;
const TIMEOUT = 4000;

export interface DomainCheck {
	name: string;
	available: boolean | null;
	reason?: string;
	price: number | null;
}

export type { Normalized };

/** Strict check of a second-level domain such as firma.cz or kavárna.com (IDN via punycode). */
export function normalizeDomain(input: unknown): Normalized {
	const n = normalizeDomainName(input);
	return n.ok ? { ...n, name: domainToUnicode(n.ascii) || n.ascii } : n;
}

/** RDAP HTTP status to availability. */
export function rdapAvailability(status: number): { available: boolean | null; reason?: string } {
	if (status === 404) return { available: true };
	if (status === 200) return { available: false };
	if (status === 429) return { available: null, reason: 'Registr nás teď brzdí, zkuste to prosím za chvíli.' };
	return { available: null, reason: 'Registr domén teď neodpovídá. Dostupnost ověříme ručně.' };
}

type Bootstrap = { services?: [string[], string[]][] };

/** Finds the RDAP base URL for a TLD in the IANA bootstrap file. */
export function rdapServer(bootstrap: Bootstrap, tld: string): string | null {
	for (const [tlds, urls] of bootstrap.services ?? []) {
		if (!tlds.includes(tld)) continue;
		const url = urls.find((u) => u.startsWith('https://')) ?? urls[0];
		if (url) return url.endsWith('/') ? url : url + '/';
	}
	return null;
}

type Fetch = typeof fetch;

/** A checker with its own caches; tests pass a mocked fetch and a clock. */
export function createDomainChecker(fetchImpl: Fetch, now: () => number = Date.now) {
	const results = new Map<string, { at: number; value: DomainCheck }>();
	let bootstrap: { at: number; data: Bootstrap } | null = null;

	async function serverFor(tld: string): Promise<string | null | undefined> {
		if (tld === 'cz') return CZ_RDAP;
		if (!bootstrap || now() - bootstrap.at > BOOTSTRAP_TTL) {
			try {
				const res = await fetchImpl(BOOTSTRAP_URL, { signal: AbortSignal.timeout(TIMEOUT) });
				if (!res.ok) throw new Error(String(res.status));
				bootstrap = { at: now(), data: (await res.json()) as Bootstrap };
			} catch {
				// keep a stale copy if there is one; undefined means "bootstrap unreachable"
				if (!bootstrap) return undefined;
			}
		}
		return rdapServer(bootstrap.data, tld);
	}

	return async function check(input: unknown): Promise<{ status: number; body: DomainCheck }> {
		const n = normalizeDomain(input);
		if (!n.ok) {
			const name = typeof input === 'string' ? input.trim().slice(0, 80) : '';
			return { status: 400, body: { name, available: null, reason: n.reason, price: null } };
		}
		const cached = results.get(n.ascii);
		if (cached && now() - cached.at < RESULT_TTL) return { status: 200, body: cached.value };

		const price = domainPrice(n.ascii);
		const base = await serverFor(n.tld);
		if (base === undefined)
			return { status: 200, body: { name: n.name, available: null, reason: 'Registr domén teď neodpovídá. Dostupnost ověříme ručně.', price } };
		if (base === null)
			return {
				status: 200,
				body: { name: n.name, available: null, reason: `Koncovku .${domainToUnicode(n.tld) || n.tld} neumíme ověřit automaticky, dostupnost potvrdíme ručně.`, price }
			};

		let status = 0;
		try {
			const res = await fetchImpl(`${base}domain/${n.ascii}`, {
				headers: { Accept: 'application/rdap+json, application/json' },
				signal: AbortSignal.timeout(TIMEOUT)
			});
			status = res.status;
			await res.body?.cancel().catch(() => {});
		} catch {
			status = 0;
		}
		const value: DomainCheck = { name: n.name, ...rdapAvailability(status), price };
		if (value.available !== null) {
			if (results.size > 5000) results.clear();
			results.set(n.ascii, { at: now(), value });
		}
		return { status: 200, body: value };
	};
}

export const checkDomain = createDomainChecker((input, init) => fetch(input, init));
