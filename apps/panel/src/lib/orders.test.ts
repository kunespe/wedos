import { describe, expect, it } from 'vitest';
import { canTransition, fieldErrors, nextStatuses, publicOrderSchema } from './orders';

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

describe('order status flow', () => {
	it('follows the manual fulfilment steps', () => {
		expect(canTransition('new', 'contacted')).toBe(true);
		expect(canTransition('provisioning', 'done')).toBe(true);
		expect(canTransition('new', 'done')).toBe(false);
		expect(canTransition('done', 'new')).toBe(false);
		expect(nextStatuses('cancelled')).toEqual(['new']);
	});
});
