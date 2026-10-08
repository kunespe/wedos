import { expect, test } from '@playwright/test';
import { login, loginAdmin } from './helpers';

test('a client files a PHP change and the admin sees the structured request', async ({ page, browser }) => {
	await login(page, 'klient@servero.test');
	await expect(page).toHaveURL(/\/app$/);
	await page.goto('/app/podpora/novy?typ=php');
	await page.locator('#f-service').selectOption({ index: 1 });
	await page.locator('#f-version').selectOption('8.3');
	await page.locator('main form button[type=submit]').last().click();
	await expect(page).toHaveURL(/\/app\/podpora\/\d+/);
	const ticketUrl = page.url();
	await expect(page.getByRole('heading', { name: /PHP 8\.3/ })).toBeVisible();

	const admin = await (await browser.newContext()).newPage();
	await loginAdmin(admin);
	await admin.goto(ticketUrl.replace('/app/podpora/', '/admin/tikety/'));
	await expect(admin.getByText('Údaje požadavku')).toBeVisible();
	await expect(admin.getByText('8.3').first()).toBeVisible();
	await admin.context().close();
});

test('an admin issues a renewal, the client sees the QR, payment extends the service', async ({ page, browser }) => {
	await loginAdmin(page);
	await page.goto('/admin/sluzby');
	await page.getByRole('link', { name: 'Web Start · arete-akce.cz' }).click();
	// The pending fixture service needs an expiry and active state before it can be renewed.
	await page.locator('#f-status').selectOption('active');
	await page.locator('#f-exp').fill('2030-05-31');
	await page.getByRole('button', { name: 'Uložit', exact: true }).click();
	await expect(page.getByText(/Služba běží\./)).toBeVisible();
	await page.getByRole('button', { name: 'Vystavit výzvu k obnově' }).click();
	await expect(page.getByText(/výzv/i).first()).toBeVisible();

	const client = await (await browser.newContext()).newPage();
	await login(client, 'klient@servero.test');
	await expect(client).toHaveURL(/\/app$/);
	await client.goto('/app/faktury');
	await expect(client.getByText(/arete-akce\.cz, prodloužení do 31\. 05\. 2031/).first()).toBeVisible();
	await expect(client.locator('svg').filter({ has: client.locator('path') }).first()).toBeVisible();
	await client.context().close();

	await page.goto('/admin/platby');
	await page.getByRole('row', { name: /arete-akce\.cz, prodloužení/ }).getByRole('link').first().click();
	await page.locator('form[action="?/paid"] button[type=submit]').click();
	await expect(page.getByText(/2031/).first()).toBeVisible();
});
