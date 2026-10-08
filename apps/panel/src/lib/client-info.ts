// Connection details shown to the customer on a service ("Připojení"). Client-safe.
// Passwords are never stored here: they are handed over out of band and rotated on request.
import { z } from 'zod';
import type { ServiceKind } from './constants';

export type InfoRow = { label: string; value: string };

export const CLIENT_INFO_LIMITS = { rows: 20, label: 60, value: 300 } as const;
export const SERVER_IP = '2.31.25.249';

const SECRET_LABEL = /hesl|passw|passwd|\bpwd\b|\bpass\b|secret|tajn|token|private key|soukrom/i;

/** True when a label looks like it would hold a password or other secret. */
export const looksSecret = (label: string) => SECRET_LABEL.test(label);

export const clientInfoSchema = z
	.array(
		z.object({
			label: z.string().trim().max(CLIENT_INFO_LIMITS.label, `Popisek má nejvýš ${CLIENT_INFO_LIMITS.label} znaků.`),
			value: z.string().trim().max(CLIENT_INFO_LIMITS.value, `Hodnota má nejvýš ${CLIENT_INFO_LIMITS.value} znaků.`)
		})
	)
	.transform((rows) => rows.filter((r) => r.label || r.value))
	.pipe(
		z
			.array(z.object({ label: z.string(), value: z.string() }))
			.max(CLIENT_INFO_LIMITS.rows, `Nejvýš ${CLIENT_INFO_LIMITS.rows} řádků.`)
			.superRefine((rows, ctx) => {
				rows.forEach((r, i) => {
					if (!r.label) ctx.addIssue({ code: 'custom', path: [i], message: `Řádek ${i + 1}: vyplňte popisek.` });
					else if (!r.value) ctx.addIssue({ code: 'custom', path: [i], message: `Řádek ${i + 1} („${r.label}“): vyplňte hodnotu, nebo řádek odeberte.` });
					else if (looksSecret(r.label))
						ctx.addIssue({
							code: 'custom',
							path: [i],
							message: `Řádek ${i + 1} („${r.label}“): hesla ani jiná tajemství sem nepatří. Neukládáme je a zákazník si nové heslo vyžádá požadavkem Přístup.`
						});
				});
			})
	);

/** Sensible starting rows per service kind; values the team must look up are left blank. */
export function presetRows(kind: ServiceKind, domain: string): InfoRow[] {
	const web: InfoRow[] = [
		{ label: 'Server', value: SERVER_IP },
		{ label: 'SFTP host', value: domain || SERVER_IP },
		{ label: 'SFTP port', value: '22' },
		{ label: 'Uživatel', value: '' },
		{ label: 'Cesta k webu', value: '' },
		{ label: 'PHP verze', value: '8.4' },
		{ label: 'Databáze host', value: '127.0.0.1' }
	];
	switch (kind) {
		case 'web':
		case 'wp':
		case 'app':
			return kind === 'wp' ? [...web, { label: 'Administrace WordPressu', value: domain ? `https://${domain}/wp-admin/` : '' }] : web;
		case 'domain':
			return [
				{ label: 'A záznam', value: SERVER_IP },
				{ label: 'CNAME www', value: domain || '' },
				{ label: 'Jmenné servery', value: '' }
			];
		case 'vps':
			return [
				{ label: 'IP adresa', value: '' },
				{ label: 'SSH port', value: '22' },
				{ label: 'Uživatel', value: '' }
			];
		default:
			return [{ label: 'Server', value: '' }];
	}
}
