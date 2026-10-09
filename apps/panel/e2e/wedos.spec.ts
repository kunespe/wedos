import { expect, test } from '@playwright/test';
import { loginAdmin } from './helpers';

// .env.e2e leaves WEDOS_WAPI_USER empty: the admin explains the missing setup and offers no WEDOS buttons.
test('domain pages degrade gracefully without WEDOS credentials', async ({ page }) => {
	await loginAdmin(page);
	await page.goto('/admin/domeny');
	await expect(page.getByText('WEDOS nenastaven')).toBeVisible();
	await expect(page.getByRole('button', { name: 'Porovnat s WEDOS' })).toHaveCount(0);
	await expect(page.getByRole('button', { name: 'WAPI ping' })).toHaveCount(0);

	await page.getByRole('link', { name: 'centrumarete.cz' }).click();
	await expect(page.getByRole('heading', { name: 'WEDOS' })).toBeVisible();
	await expect(page.getByText('Propojení s WEDOS WAPI není v tomto prostředí nastavené')).toBeVisible();
	await expect(page.getByRole('button', { name: 'Registrovat' })).toHaveCount(0);
	await expect(page.getByRole('button', { name: 'Prodloužit o 1 rok' })).toHaveCount(0);
	await expect(page.getByRole('button', { name: 'Uložit' })).toBeVisible();
});
