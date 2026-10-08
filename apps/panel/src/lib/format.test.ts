import { describe, expect, it } from 'vitest';
import { bytes, czk, daysUntil, periodTotal } from './format';

describe('format', () => {
	it('formats prices', () => {
		expect(czk(2990)).toBe('2 990 Kč');
		expect(czk(null)).toBe('Individuálně');
	});
	it('charges ten months for a year', () => {
		expect(periodTotal(149, 'year')).toBe(1490);
		expect(periodTotal(149, 'month')).toBe(149);
	});
	it('counts days until a date', () => {
		const tomorrow = new Date(Date.now() + 86_400_000 * 1.5).toISOString().slice(0, 10);
		expect(daysUntil(tomorrow)).toBeGreaterThanOrEqual(1);
		expect(daysUntil(null)).toBeNull();
	});
	it('formats sizes', () => {
		expect(bytes(1.5 * 1024 ** 3)).toBe('1,5 GB');
		expect(bytes(300 * 1024 ** 2)).toBe('300 MB');
	});
});
