import { expect, test } from '@playwright/test';
import { loginAdmin } from './helpers';

// The storefront basket: a domains-only order reaches the admin with prices and becomes domain records, no service.
test('domain basket order shows its domains in admin and converts into domain records', async ({ page, request }) => {
	const stamp = Date.now();
	const names = [`e2e-kosik-${stamp}.cz`, `e2e-kosik-${stamp}.eu`, `e2e-prevod-${stamp}.com`];
	const res = await request.post('/api/orders', {
		headers: { Origin: 'http://127.0.0.1:4410' },
		data: {
			plan: 'domeny',
			period: 'month',
			domain: '',
			domainMode: 'none',
			domains: [
				{ name: names[0], mode: 'register', years: 2 },
				{ name: names[1].toUpperCase(), mode: 'register', years: 1 },
				{ name: names[2], mode: 'transfer', years: 1 },
				{ name: names[0], mode: 'register', years: 1 }
			],
			name: 'Karel Košík',
			email: `e2e-kosik-${stamp}@example.cz`,
			phone: '',
			company: '',
			ico: '',
			dic: '',
			address: '',
			note: '',
			website: '',
			consent: true
		}
	});
	expect(res.status()).toBe(201);
	const { id } = await res.json();

	await loginAdmin(page);
	await page.goto(`/admin/objednavky/${id}`);
	const table = page.locator('section', { has: page.getByRole('heading', { name: 'Domény v objednávce' }) }).locator('table');
	for (const n of names) await expect(table.getByText(n, { exact: true })).toBeVisible();
	// duplicates collapse, .cz is priced from the catalog (249 Kč per year, 2 years), the rest is to confirm
	await expect(table.locator('tbody tr')).toHaveCount(3);
	await expect(table.locator('tr', { hasText: names[0] })).toContainText('498 Kč');
	await expect(table.locator('tr', { hasText: names[1] })).toContainText('potvrdit');
	await expect(table.locator('tr', { hasText: names[2] })).toContainText('Převod');

	await page.getByLabel('Poslat zákazníkovi pozvánku e-mailem').uncheck();
	await page.getByRole('button', { name: 'Založit zákazníka a domény' }).click();
	await expect(page.getByText('Zákazník a domény založeny.')).toBeVisible();

	await page.goto('/admin/domeny');
	for (const n of names) await expect(page.getByText(n, { exact: true })).toBeVisible();
});

test('a domains-only order needs a valid, non-empty basket', async ({ request }) => {
	const base = { plan: 'domeny', period: 'month', name: 'Karel Košík', email: 'e2e-kosik@example.cz', consent: true };
	const empty = await request.post('/api/orders', { headers: { Origin: 'http://127.0.0.1:4410' }, data: base });
	expect(empty.status()).toBe(400);
	expect((await empty.json()).errors).toMatchObject({ domains: expect.any(String) });
	const bad = await request.post('/api/orders', {
		headers: { Origin: 'http://127.0.0.1:4410' },
		data: { ...base, domains: [{ name: 'www.firma.cz', mode: 'register', years: 1 }] }
	});
	expect(bad.status()).toBe(400);
	expect((await bad.json()).errors.domains).toContain('www.firma.cz');
});
