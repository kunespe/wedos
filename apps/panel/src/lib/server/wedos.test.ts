import { createHash } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	checkDomain,
	compareDomains,
	contactFromCustomer,
	contactPayload,
	createDomain,
	domainInfo,
	encodeRequest,
	listDomains,
	nameservers,
	normalisePhone,
	pragueHour,
	renewDomain,
	rulesFromName,
	splitAddress,
	transferCheck,
	wapi,
	WAPI_URL,
	wapiAuth,
	WapiError
} from './wedos';

const sha1 = (s: string) => createHash('sha1').update(s).digest('hex');
const config = { user: 'admin@serveros.cz', password: 'wapi-heslo', live: false };

/** fetch stub answering every call with the given WAPI response; records the decoded request. */
function fakeWapi(response: Record<string, unknown>) {
	const calls: { url: string; body: string; json: { request: Record<string, unknown> } }[] = [];
	const fn = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
		const body = String(init?.body);
		calls.push({ url: String(url), body, json: JSON.parse(new URLSearchParams(body).get('request')!) });
		return Response.json({ response });
	}) as unknown as typeof fetch;
	return { fetch: fn, calls };
}

afterEach(() => vi.useRealTimers());

describe('auth hash', () => {
	it('uses the hour in Europe/Prague (winter, UTC+1)', () => {
		vi.useFakeTimers({ toFake: ['Date'] });
		vi.setSystemTime(new Date('2026-01-15T09:30:00Z'));
		expect(pragueHour()).toBe('10');
		expect(wapiAuth(config.user, config.password)).toBe(sha1(config.user + sha1(config.password) + '10'));
	});

	it('uses the hour in Europe/Prague (summer, UTC+2) and pads it', () => {
		expect(pragueHour(new Date('2026-07-15T22:05:00Z'))).toBe('00');
		expect(pragueHour(new Date('2026-07-15T07:05:00Z'))).toBe('09');
		expect(wapiAuth('a@b.cz', 'x', new Date('2026-07-15T07:05:00Z'))).toBe(sha1('a@b.cz' + sha1('x') + '09'));
	});
});

describe('request encoding', () => {
	it('sends request=<urlencoded JSON> as a form body', () => {
		const body = encodeRequest({ request: { user: 'u@x.cz', auth: 'h', command: 'ping', clTRID: 'srv-1' } });
		expect(body.startsWith('request=')).toBe(true);
		expect(body).not.toContain('{');
		expect(JSON.parse(new URLSearchParams(body).get('request')!)).toEqual({ request: { user: 'u@x.cz', auth: 'h', command: 'ping', clTRID: 'srv-1' } });
	});

	it('posts to the JSON endpoint with auth, clTRID and no test flag for read-only commands', async () => {
		vi.useFakeTimers({ toFake: ['Date'] });
		vi.setSystemTime(new Date('2026-03-02T13:00:00Z'));
		const w = fakeWapi({ code: 1000, result: 'OK' });
		await wapi('ping', undefined, { config, fetch: w.fetch });
		await checkDomain('firma.cz', { config, fetch: w.fetch });
		expect(w.calls[0].url).toBe(WAPI_URL);
		const req = w.calls[0].json.request;
		expect(req).toMatchObject({ user: config.user, command: 'ping', auth: sha1(config.user + sha1(config.password) + '14') });
		expect(req.clTRID).toMatch(/^srv-\d+-[0-9a-f]{6}$/);
		expect(req).not.toHaveProperty('test');
		expect(req).not.toHaveProperty('data');
		expect(w.calls[1].json.request).toMatchObject({ command: 'domain-check', data: { name: 'firma.cz' } });
		expect(w.calls[1].json.request).not.toHaveProperty('test');
	});

	it('marks changing commands as test unless live', async () => {
		const w = fakeWapi({ code: 1000, result: 'OK', test: 1, data: {} });
		const r = await renewDomain('firma.cz', 1, { config, fetch: w.fetch });
		expect(w.calls[0].json.request).toMatchObject({ command: 'domain-renew', test: 1, data: { name: 'firma.cz', period: 1 } });
		expect(r.test).toBe(true);

		const live = fakeWapi({ code: 1000, result: 'OK', data: { expiration: '2027-10-09' } });
		const r2 = await renewDomain('firma.cz', 1, { config: { ...config, live: true }, fetch: live.fetch });
		expect(live.calls[0].json.request).not.toHaveProperty('test');
		expect(r2).toMatchObject({ test: false, pending: false, expiration: '2027-10-09' });
	});

	it('builds domain-create with nameservers and rules', async () => {
		const w = fakeWapi({ code: 1001, result: 'Pending' });
		const r = await createDomain(
			{ name: 'firma.cz', period: 1, ownerC: 'SRV-1', rules: { fname: 'Jan', lname: 'Novák' }, nsset: 'WEDOS-NS', dns: [] },
			{ config, fetch: w.fetch }
		);
		expect(w.calls[0].json.request.data).toEqual({ name: 'firma.cz', period: 1, owner_c: 'SRV-1', nsset: 'WEDOS-NS', rules: { fname: 'Jan', lname: 'Novák' } });
		expect(r).toMatchObject({ pending: true, test: true, expiration: null });
	});
});

describe('response codes', () => {
	it('throws WapiError with a Czech message for errors', async () => {
		const w = fakeWapi({ code: 2051, result: 'Access not allowed from this IP' });
		const err = await wapi('ping', undefined, { config, fetch: w.fetch }).catch((e) => e);
		expect(err).toBeInstanceOf(WapiError);
		expect(err).toMatchObject({ code: 2051, result: 'Access not allowed from this IP' });
		expect(err.message).toContain('2.31.25.249');
		for (const code of [2050, 2052, 2006, 3002, 3223]) {
			const e = await wapi('ping', undefined, { config, fetch: fakeWapi({ code, result: 'x' }).fetch }).catch((x) => x);
			expect(e.code).toBe(code);
			expect(e.message).not.toContain('WEDOS vrátil chybu');
		}
		const unknown = await wapi('ping', undefined, { config, fetch: fakeWapi({ code: '2999', result: 'Weird' }).fetch }).catch((x) => x);
		expect(unknown.message).toBe('WEDOS vrátil chybu 2999: Weird.');
	});

	it('treats domain-check and transfer-check answers as results', async () => {
		expect(await checkDomain('a.cz', { config, fetch: fakeWapi({ code: 1000, result: 'OK' }).fetch })).toMatchObject({ available: true });
		expect(await checkDomain('a.cz', { config, fetch: fakeWapi({ code: 3201, result: 'Taken' }).fetch })).toMatchObject({ available: false, code: 3201, message: 'Doména je už registrovaná.' });
		expect(await transferCheck('a.cz', { config, fetch: fakeWapi({ code: 3218, result: 'No' }).fetch })).toMatchObject({ possible: false });
	});

	it('refuses to call without credentials and reports network failures', async () => {
		await expect(wapi('ping', undefined, { config: { user: '', password: '', live: false } })).rejects.toThrow('WEDOS není nastavený');
		const broken = vi.fn(async () => {
			throw new TypeError('fetch failed');
		}) as unknown as typeof fetch;
		await expect(wapi('ping', undefined, { config, fetch: broken })).rejects.toMatchObject({ code: 0, message: 'Spojení s WEDOS WAPI selhalo.' });
	});

	it('reads domain-info and domains-list data', async () => {
		const info = await domainInfo('a.cz', {
			config,
			fetch: fakeWapi({ code: 1000, result: 'OK', data: { domain: { name: 'a.cz', status: 'active', owner_c: 'SRV-1', nsset: 'NS', expiration: '2027-01-31' } } }).fetch
		});
		expect(info).toMatchObject({ status: 'active', owner_c: 'SRV-1', expiration: '2027-01-31' });
		const list = await listDomains(undefined, { config, fetch: fakeWapi({ code: 1000, result: 'OK', data: { domain: { 0: { name: 'A.cz', status: 'active' }, 1: { name: 'b.eu', status: 'expired' } } } }).fetch });
		expect(list).toEqual([
			{ name: 'a.cz', status: 'active' },
			{ name: 'b.eu', status: 'expired' }
		]);
	});
});

describe('normalisePhone', () => {
	it.each([
		['777 000 111', '+420 777000111'],
		['777000111', '+420 777000111'],
		['+420777000111', '+420 777000111'],
		['+420 777 000 111', '+420 777000111'],
		['+420.777000111', '+420 777000111'],
		['00420 777-000-111', '+420 777000111'],
		['+421 905 123 456', '+421 905123456'],
		['+49 30 1234567', '+49 301234567'],
		['', '']
	])('%s -> %s', (input, out) => expect(normalisePhone(input)).toBe(out));

	it('rejects what it cannot understand', () => {
		expect(normalisePhone('12345')).toBeNull();
		expect(normalisePhone('+4930123456')).toBeNull();
		expect(normalisePhone('+420 77700011')).toBeNull();
	});
});

describe('contacts and helpers', () => {
	it('prefills a contact from the customer, IČO as ident', () => {
		const c = contactFromCustomer({ name: 'Lucie Malá', company: 'Květiny s.r.o.', ico: '12345678', dic: 'CZ12345678', address: 'Hlavní 12, 301 00 Plzeň', email: 'l@x.cz', phone: '777 000 111' });
		expect(c).toEqual({
			fname: 'Lucie',
			lname: 'Malá',
			company: 'Květiny s.r.o.',
			addr_street: 'Hlavní 12',
			addr_city: 'Plzeň',
			addr_zip: '30100',
			addr_country: 'cz',
			phone: '+420 777000111',
			email: 'l@x.cz',
			notify_email: 'l@x.cz',
			ident_type: 'ico',
			ident: '12345678',
			dic: 'CZ12345678'
		});
		expect(contactPayload({ ...c, company: '', dic: '', addr_country: 'CZ' })).not.toHaveProperty('company');
		expect(contactPayload({ ...c, addr_country: 'CZ' }).addr_country).toBe('cz');
	});

	it('splits addresses in a few common shapes', () => {
		expect(splitAddress('Hlavní 12, Plzeň, 30100')).toEqual({ street: 'Hlavní 12', city: 'Plzeň', zip: '30100' });
		expect(splitAddress('Na Kopci 5, 110 00 Praha 1')).toEqual({ street: 'Na Kopci 5', city: 'Praha 1', zip: '11000' });
		expect(splitAddress('')).toEqual({ street: '', city: '', zip: '' });
	});

	it('derives rules and nameservers', () => {
		expect(rulesFromName('Jan Petr Novák')).toEqual({ fname: 'Jan Petr', lname: 'Novák' });
		expect(nameservers('a.cz', 'NSSET-1', ['ns1.x.cz'])).toEqual({ nsset: 'NSSET-1' });
		expect(nameservers('a.com', 'NSSET-1', ['ns1.x.cz', 'ns2.x.cz'])).toEqual({
			dns: { server1: { name: 'ns1.x.cz', addr_ipv4: '', addr_ipv6: '' }, server2: { name: 'ns2.x.cz', addr_ipv4: '', addr_ipv6: '' } }
		});
		expect(nameservers('a.com', '', [])).toEqual({});
	});

	it('compares WEDOS with the panel', () => {
		const r = compareDomains(
			[
				{ name: 'a.cz', status: 'active' },
				{ name: 'jen-wedos.cz', status: 'active' }
			],
			[
				{ id: 1, name: 'a.cz', registrar: 'WEDOS' },
				{ id: 2, name: 'chybi.cz', registrar: 'WEDOS' },
				{ id: 3, name: 'subreg.cz', registrar: 'Subreg' }
			]
		);
		expect(r.onlyWedos.map((d) => d.name)).toEqual(['jen-wedos.cz']);
		expect(r.missingAtWedos.map((d) => d.name)).toEqual(['chybi.cz']);
		expect(r.matched).toBe(1);
	});
});
