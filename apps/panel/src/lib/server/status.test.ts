import { describe, expect, it } from 'vitest';
import { assemble, componentState, DAYS, overallState, steps, toDays } from './status';

const end = Date.UTC(2026, 9, 9, 10, 0) / 1000;

describe('toDays', () => {
	it('returns one entry per day, oldest first, null where unmeasured', () => {
		const s = steps(end);
		const days = toDays([[s[DAYS - 1], '1'], [s[DAYS - 2], '0.995']], end);
		expect(days).toHaveLength(DAYS);
		expect(days[DAYS - 1]).toEqual({ date: '2026-10-09', uptime: 100 });
		expect(days[DAYS - 2]).toEqual({ date: '2026-10-08', uptime: 99.5 });
		expect(days[0].uptime).toBeNull();
	});
});

describe('states', () => {
	it('maps current availability', () => {
		expect(componentState(null)).toBe('unknown');
		expect(componentState(100)).toBe('ok');
		expect(componentState(95)).toBe('degraded');
		expect(componentState(0)).toBe('down');
	});

	it('only a critical component down is an outage', () => {
		expect(overallState([{ id: 'weby', state: 'ok' }, { id: 'monitoring', state: 'down' }])).toBe('partial');
		expect(overallState([{ id: 'server', state: 'down' }, { id: 'panel', state: 'ok' }])).toBe('outage');
		expect(overallState([{ id: 'weby', state: 'ok' }, { id: 'panel', state: 'unknown' }])).toBe('ok');
		expect(overallState([{ id: 'weby', state: 'unknown' }])).toBe('unknown');
	});
});

describe('assemble', () => {
	it('builds worst-per-day bars, 90-day averages and incidents', () => {
		const day = (uptime: number | null, date = '2026-10-08') => ({ date, uptime });
		const status = assemble(
			[
				{ def: { id: 'weby', name: 'Weby zákazníků', note: '' }, current: 100, days: [day(100), day(99.5, '2026-10-09')] },
				{ def: { id: 'panel', name: 'Klientský panel', note: '' }, current: 100, days: [day(98), day(null, '2026-10-09')] }
			],
			new Date(end * 1000)
		);
		expect(status.overall).toBe('ok');
		expect(status.days).toEqual([day(98), day(99.5, '2026-10-09')]);
		expect(status.components[0].uptime90).toBe(99.75);
		expect(status.components[1].uptime90).toBe(98);
		expect(status.incidents).toEqual([
			{ date: '2026-10-09', component: 'Weby zákazníků', uptime: 99.5 },
			{ date: '2026-10-08', component: 'Klientský panel', uptime: 98 }
		]);
		// aggregates only: nothing that looks like a customer label
		expect(JSON.stringify(status)).not.toMatch(/service_id|customer_id|domain/);
	});
});
