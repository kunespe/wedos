import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { DOMAIN_ONLY_PLAN, DOMAIN_PRICES } from '../domains';
import { createDomainChecker, CZ_DOMAIN_PRICE, normalizeDomain, rdapAvailability, rdapServer } from './domain-check';

const bootstrap = {
	services: [
		[['com', 'net'], ['https://rdap.verisign.com/com/v1/']],
		[['xn--p1ai'], ['http://rdap.example/', 'https://rdap.example/rf']]
	]
};

/** fetch stub: the bootstrap file plus a fixed RDAP status per URL. */
function fakeFetch(statuses: Record<string, number>) {
	return vi.fn(async (input: string | URL | Request) => {
		const url = String(input);
		if (url === 'https://data.iana.org/rdap/dns.json') return Response.json(bootstrap);
		if (url in statuses) return new Response(null, { status: statuses[url] });
		throw new Error('unexpected ' + url);
	}) as unknown as typeof fetch & ReturnType<typeof vi.fn>;
}

describe('normalizeDomain', () => {
	it('accepts and lower-cases a plain domain', () => {
		expect(normalizeDomain(' Firma.CZ ')).toEqual({ ok: true, ascii: 'firma.cz', name: 'firma.cz', tld: 'cz' });
		expect(normalizeDomain('moje-firma.com.')).toMatchObject({ ok: true, ascii: 'moje-firma.com' });
	});

	it('converts IDN to punycode outside .cz', () => {
		expect(normalizeDomain('kavárna.com')).toEqual({ ok: true, ascii: 'xn--kavrna-rta.com', name: 'kavárna.com', tld: 'com' });
	});

	it('rejects diacritics in .cz', () => {
		expect(normalizeDomain('kavárna.cz')).toMatchObject({ ok: false, reason: expect.stringContaining('diakritiku') });
	});

	it.each([
		['', 'empty'],
		['firma', 'no tld'],
		['www.firma.cz', 'third level'],
		['https://firma.cz', 'url'],
		['firma.cz/kontakt', 'path'],
		['-firma.cz', 'leading hyphen'],
		['firma-.cz', 'trailing hyphen'],
		['fi--rma.cz', 'hyphens in 3rd and 4th place'],
		['fir_ma.cz', 'underscore'],
		['firma.c', 'one-letter tld'],
		['firma.123', 'numeric tld'],
		['a'.repeat(64) + '.cz', 'label over 63']
	])('rejects %s (%s)', (input) => {
		expect(normalizeDomain(input).ok).toBe(false);
	});

	it('rejects non-strings', () => {
		expect(normalizeDomain(undefined).ok).toBe(false);
		expect(normalizeDomain(42).ok).toBe(false);
	});
});

describe('RDAP mapping', () => {
	it('maps statuses', () => {
		expect(rdapAvailability(404)).toEqual({ available: true });
		expect(rdapAvailability(200)).toEqual({ available: false });
		expect(rdapAvailability(429).available).toBeNull();
		expect(rdapAvailability(500).available).toBeNull();
		expect(rdapAvailability(0).available).toBeNull();
	});

	it('picks the https server from the bootstrap', () => {
		expect(rdapServer(bootstrap as never, 'net')).toBe('https://rdap.verisign.com/com/v1/');
		expect(rdapServer(bootstrap as never, 'xn--p1ai')).toBe('https://rdap.example/rf/');
		expect(rdapServer(bootstrap as never, 'cz')).toBeNull();
	});
});

describe('createDomainChecker', () => {
	it('free .cz with price, straight to CZ.NIC', async () => {
		const f = fakeFetch({ 'https://rdap.nic.cz/domain/volna.cz': 404 });
		const r = await createDomainChecker(f)('volna.cz');
		expect(r).toEqual({ status: 200, body: { name: 'volna.cz', available: true, price: CZ_DOMAIN_PRICE } });
		expect(f).toHaveBeenCalledTimes(1);
	});

	it('taken .com via the bootstrap, no price', async () => {
		const f = fakeFetch({ 'https://rdap.verisign.com/com/v1/domain/example.com': 200 });
		const r = await createDomainChecker(f)('example.com');
		expect(r.body).toEqual({ name: 'example.com', available: false, price: null });
	});

	it('unsupported tld answers null with a reason', async () => {
		const r = await createDomainChecker(fakeFetch({}))('firma.sk');
		expect(r.body.available).toBeNull();
		expect(r.body.reason).toContain('.sk');
	});

	it('invalid input is a 400 and makes no request', async () => {
		const f = fakeFetch({});
		const r = await createDomainChecker(f)('www.firma.cz');
		expect(r.status).toBe(400);
		expect(r.body.available).toBeNull();
		expect(f).not.toHaveBeenCalled();
	});

	it('registry errors and timeouts are unknown, not free', async () => {
		const f = vi.fn(async () => {
			throw new DOMException('timeout', 'TimeoutError');
		}) as unknown as typeof fetch;
		const r = await createDomainChecker(f)('firma.cz');
		expect(r.body.available).toBeNull();
		expect(r.body.reason).toBeTruthy();
	});

	it('caches definite answers for 10 minutes and the bootstrap for a day', async () => {
		let t = 0;
		const f = fakeFetch({ 'https://rdap.verisign.com/com/v1/domain/a.com': 200, 'https://rdap.verisign.com/com/v1/domain/b.com': 404 });
		const check = createDomainChecker(f, () => t);
		await check('a.com');
		await check('a.com');
		expect(f).toHaveBeenCalledTimes(2); // bootstrap + one RDAP call
		t = 11 * 60 * 1000;
		await check('a.com');
		await check('b.com');
		expect(f).toHaveBeenCalledTimes(4); // bootstrap still cached
	});

	it('does not cache unknown answers', async () => {
		const f = fakeFetch({ 'https://rdap.nic.cz/domain/firma.cz': 503 });
		const check = createDomainChecker(f);
		await check('firma.cz');
		await check('firma.cz');
		expect(f).toHaveBeenCalledTimes(2);
	});
});

describe('catalog', () => {
	it('.cz price matches catalog/plans.json', () => {
		const catalog = JSON.parse(readFileSync(new URL('../../../../../catalog/plans.json', import.meta.url), 'utf8')) as {
			extras: { code: string; price: number }[];
		};
		expect(catalog.extras.find((x) => x.code === 'domena-cz')?.price).toBe(CZ_DOMAIN_PRICE);
	});

	it('domain prices and the domain-only plan match catalog/plans.json', () => {
		const catalog = JSON.parse(readFileSync(new URL('../../../../../catalog/plans.json', import.meta.url), 'utf8')) as {
			domains: Record<string, number | null>;
			plans: { code: string; category: string; kind: string; monthly: number | null }[];
		};
		expect(catalog.domains).toEqual(DOMAIN_PRICES);
		expect(catalog.plans.find((p) => p.code === DOMAIN_ONLY_PLAN)).toMatchObject({ category: 'domains', kind: 'domain', monthly: null });
	});
});
