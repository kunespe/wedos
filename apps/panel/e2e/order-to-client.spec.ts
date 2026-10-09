import { expect, test } from '@playwright/test';
import { loginAdmin } from './helpers';

// The core business loop: a storefront order becomes a customer who can log in and see the service.
test('web order is converted by an admin and the customer activates the account', async ({ page, request, browser }) => {
	const email = `e2e-${Date.now()}@example.cz`;
	const res = await request.post('/api/orders', {
		headers: { Origin: 'http://127.0.0.1:4410' },
		data: {
			plan: 'web-plus',
			period: 'year',
			domain: 'e2e-pekarna.cz',
			domainMode: 'register',
			name: 'Eva Testová',
			email,
			phone: '',
			company: 'E2E Pekárna s.r.o.',
			ico: '',
			dic: '',
			address: '',
			note: 'Objednávka z e2e testu.',
			website: '',
			consent: true
		}
	});
	expect(res.status()).toBe(201);
	const { id } = await res.json();

	await loginAdmin(page);
	await page.goto('/admin/objednavky');
	await expect(page.getByRole('link', { name: `#${id}` })).toBeVisible();
	await page.goto(`/admin/objednavky/${id}`);
	await page.getByLabel('Poslat zákazníkovi pozvánku e-mailem').uncheck();
	await page.getByRole('button', { name: 'Založit zákazníka a službu' }).click();
	await expect(page.getByText('Zákazník a služba založeni.')).toBeVisible();
	const invite = (await page.locator('code', { hasText: '/pozvanka/' }).textContent())!.trim();

	// The customer opens the link in their own browser.
	const client = await (await browser.newContext()).newPage();
	await client.goto(invite.replace(/^https?:\/\/[^/]+/, ''));
	await client.getByLabel('Heslo', { exact: true }).fill('e2e-pekarna-heslo-2026');
	await client.getByLabel('Heslo znovu').fill('e2e-pekarna-heslo-2026');
	await client.getByRole('button', { name: 'Uložit a pokračovat' }).click();
	await expect(client).toHaveURL(/\/app$/);
	await expect(client.getByText('Web Plus · e2e-pekarna.cz').first()).toBeVisible();
	await expect(client.getByText('Zřizujeme').first()).toBeVisible();
	await client.context().close();
});

test('public order API rejects bad input and foreign origins', async ({ request }) => {
	const bad = await request.post('/api/orders', { headers: { Origin: 'http://127.0.0.1:4410' }, data: { plan: 'web-plus', period: 'year', name: 'x', email: 'nope', consent: false } });
	expect(bad.status()).toBe(400);
	expect((await bad.json()).errors).toMatchObject({ email: expect.any(String), consent: expect.any(String) });
	const foreign = await request.post('/api/orders', { headers: { Origin: 'https://evil.example' }, data: {} });
	expect(foreign.status()).toBe(403);
});
