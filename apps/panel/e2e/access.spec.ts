import { expect, test } from '@playwright/test';
import { login } from './helpers';

test('anonymous visitors are sent to the login page', async ({ page }) => {
	await page.goto('/admin/objednavky');
	await expect(page).toHaveURL(/\/prihlaseni\?next=/);
});

test('a client cannot reach the admin or another customer’s data', async ({ page }) => {
	await login(page, 'klient@servero.test');
	await expect(page).toHaveURL(/\/app$/);
	expect((await page.goto('/admin'))!.status()).toBe(403);
	expect((await page.goto('/app/sluzby/999999'))!.status()).toBe(404);
	expect((await page.goto('/app/podpora/999999'))!.status()).toBe(404);
	// branded error page with the code and a way back
	await expect(page.getByRole('heading', { name: 'Stránka nenalezena' })).toBeVisible();
	await expect(page.getByText('chyba 404')).toBeVisible();
	await expect(page.getByRole('link', { name: 'Zpět do panelu' })).toHaveAttribute('href', '/');
});

test('an unknown address shows the branded 404 page', async ({ page }) => {
	expect((await page.goto('/tohle-neexistuje'))!.status()).toBe(404);
	await expect(page.getByRole('heading', { name: 'Stránka nenalezena' })).toBeVisible();
	await expect(page.getByText('SERVEROS', { exact: true })).toBeVisible();
});

test('wrong password is refused without revealing the account', async ({ page }) => {
	await login(page, 'klient@servero.test', 'spatne-heslo-123');
	await expect(page.getByText('Nesprávný e-mail nebo heslo.')).toBeVisible();
	await login(page, 'nikdo@example.cz', 'spatne-heslo-123');
	await expect(page.getByText('Nesprávný e-mail nebo heslo.')).toBeVisible();
});

test('internal metrics are not served through a proxy', async ({ request }) => {
	expect((await request.get('/internal/metrics', { headers: { 'X-Forwarded-For': '1.2.3.4' } })).status()).toBe(404);
	expect(await (await request.get('/internal/metrics')).text()).toContain('servero_orders_total');
});
