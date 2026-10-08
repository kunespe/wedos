import { describe, expect, it } from 'vitest';
import { czechIban, ibanValid, nextCoverage, spayd, variableSymbol, withVat } from './payments';

describe('payments', () => {
	it('adds VAT and rounds to crowns', () => {
		expect(withVat(349, 0)).toBe(349);
		expect(withVat(349, 21)).toBe(422);
		expect(withVat(1290, 21)).toBe(1561);
	});

	it('builds an 8-digit variable symbol', () => {
		expect(variableSymbol(42, 2026)).toBe('26000042');
	});

	it('converts Czech accounts to valid IBANs', () => {
		// Example account published by Česká spořitelna.
		expect(czechIban('19-2000145399/0800')).toBe('CZ6508000000192000145399');
		const iban = czechIban('2000000000/2010')!;
		expect(ibanValid(iban)).toBe(true);
		expect(czechIban('nonsense')).toBeNull();
		expect(ibanValid('CZ6508000000192000145398')).toBe(false);
	});

	it('produces a SPAYD string with ASCII message', () => {
		expect(spayd({ iban: 'CZ6508000000192000145399', amount: 349, vs: '26000042', message: 'Služba WP Provoz · č. 42', dueDate: '2026-10-23' })).toBe(
			'SPD*1.0*ACC:CZ6508000000192000145399*AM:349.00*CC:CZK*X-VS:26000042*MSG:SLUZBA WP PROVOZ  C. 42*DT:20261023'
		);
	});

	it('stacks early renewals and restarts late ones from today', () => {
		const today = new Date('2026-10-09T10:00:00Z');
		expect(nextCoverage('2027-03-31', 'year', today)).toBe('2028-03-31');
		expect(nextCoverage('2026-10-20', 'month', today)).toBe('2026-11-20');
		expect(nextCoverage('2026-09-01', 'year', today)).toBe('2027-10-08');
		expect(nextCoverage(null, 'month', today)).toBe('2026-11-08');
	});
});
