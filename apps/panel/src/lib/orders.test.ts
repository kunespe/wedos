import { describe, expect, it } from 'vitest';
import { basketTotal, priced, searchNames } from './domains';
import { canTransition, fieldErrors, nextStatuses, panelOrderSchema, publicOrderSchema } from './orders';

const valid = {
	plan: 'web-start',
	period: 'year',
	domain: 'https://WWW.Firma.cz/kontakt',
	domainMode: 'own',
	name: 'Jana Nováková',
	email: ' Jana@Firma.CZ ',
	phone: '+420 777 000 111',
	company: '',
	ico: '27082440',
	dic: '',
	address: '',
	note: '',
	website: '',
	consent: true
};

describe('publicOrderSchema', () => {
	it('normalises domain and e-mail', () => {
		const r = publicOrderSchema.parse(valid);
		expect(r.domain).toBe('firma.cz');
		expect(r.email).toBe('jana@firma.cz');
	});

	it('requires consent', () => {
		const r = publicOrderSchema.safeParse({ ...valid, consent: false });
		expect(r.success).toBe(false);
		if (!r.success) expect(fieldErrors(r.error).consent).toMatch(/souhlasu/);
	});

	it('rejects a bad IČO and a missing domain when one is expected', () => {
		const r = publicOrderSchema.safeParse({ ...valid, ico: '123', domain: '', domainMode: 'register' });
		expect(r.success).toBe(false);
		if (!r.success) {
			const e = fieldErrors(r.error);
			expect(e.ico).toBeDefined();
			expect(e.domain).toBeDefined();
		}
	});

	it('allows no domain', () => {
		expect(publicOrderSchema.safeParse({ ...valid, domain: '', domainMode: 'none' }).success).toBe(true);
	});

	it('rejects unknown periods and oversized notes', () => {
		expect(publicOrderSchema.safeParse({ ...valid, period: 'week' }).success).toBe(false);
		expect(publicOrderSchema.safeParse({ ...valid, note: 'x'.repeat(2001) }).success).toBe(false);
	});
});

describe('domain basket', () => {
	it('normalises names, drops duplicates and defaults to one year', () => {
		const r = publicOrderSchema.parse({
			...valid,
			domains: [
				{ name: ' Firma.CZ ', mode: 'register' },
				{ name: 'firma.cz', mode: 'transfer', years: 3 },
				{ name: 'kavárna.com', mode: 'transfer', years: '2' }
			]
		});
		expect(r.domains).toEqual([
			{ name: 'firma.cz', mode: 'register', years: 1 },
			{ name: 'kavárna.com', mode: 'transfer', years: 2 }
		]);
	});

	it('rejects bad names, years out of range and oversized baskets', () => {
		const bad = publicOrderSchema.safeParse({ ...valid, domains: [{ name: 'www.firma.cz', mode: 'register', years: 1 }] });
		expect(bad.success).toBe(false);
		if (!bad.success) expect(fieldErrors(bad.error).domains).toMatch(/www\.firma\.cz/);
		expect(publicOrderSchema.safeParse({ ...valid, domains: [{ name: 'firma.cz', mode: 'register', years: 4 }] }).success).toBe(false);
		expect(publicOrderSchema.safeParse({ ...valid, domains: [{ name: 'firma.cz', mode: 'renew', years: 1 }] }).success).toBe(false);
		const many = Array.from({ length: 21 }, (_, i) => ({ name: `firma${i}.cz`, mode: 'register', years: 1 }));
		expect(publicOrderSchema.safeParse({ ...valid, domains: many }).success).toBe(false);
	});

	it('needs a non-empty basket for a domain-only order and ignores the hosting domain then', () => {
		const empty = publicOrderSchema.safeParse({ ...valid, plan: 'domeny', domain: '', domainMode: 'register' });
		expect(empty.success).toBe(false);
		if (!empty.success) expect(Object.keys(fieldErrors(empty.error))).toEqual(['domains']);
		const ok = publicOrderSchema.safeParse({ ...valid, plan: 'domeny', domain: '', domainMode: 'register', domains: [{ name: 'firma.cz', mode: 'register', years: 1 }] });
		expect(ok.success).toBe(true);
	});

	it('reads the basket from a form field in the client zone', () => {
		const r = panelOrderSchema.safeParse({ plan: 'domeny', period: 'year', domainMode: 'none', domains: JSON.stringify([{ name: 'firma.eu', mode: 'register', years: 2 }]) });
		expect(r.success && r.data.domains).toEqual([{ name: 'firma.eu', mode: 'register', years: 2 }]);
		expect(panelOrderSchema.safeParse({ plan: 'domeny', period: 'year', domainMode: 'none', domains: 'nonsense' }).success).toBe(false);
	});

	it('prices .cz from the catalog and leaves the rest to confirm', () => {
		const list = priced([
			{ name: 'firma.cz', mode: 'register', years: 2 },
			{ name: 'firma.eu', mode: 'register', years: 1 }
		]);
		expect(list.map((d) => d.price)).toEqual([249, null]);
		expect(basketTotal(list)).toEqual({ known: 498, unknown: 1 });
	});

	it('searches the typed TLD first, then the popular ones', () => {
		expect(searchNames('https://www.Firma.de/kontakt')).toEqual(['firma.de', 'firma.cz', 'firma.eu', 'firma.sk', 'firma.com']);
		expect(searchNames('firma')).toEqual(['firma.cz', 'firma.eu', 'firma.sk', 'firma.com']);
		expect(searchNames('firma.cz')).toEqual(['firma.cz', 'firma.eu', 'firma.sk', 'firma.com']);
	});
});

describe('order status flow', () => {
	it('follows the manual fulfilment steps', () => {
		expect(canTransition('new', 'contacted')).toBe(true);
		expect(canTransition('provisioning', 'done')).toBe(true);
		expect(canTransition('new', 'done')).toBe(false);
		expect(canTransition('done', 'new')).toBe(false);
		expect(nextStatuses('cancelled')).toEqual(['new']);
	});
});
