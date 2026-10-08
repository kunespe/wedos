import { decodeBase64 } from '@oslojs/encoding';
import { generateTOTP } from '@oslojs/otp';
import { expect, type Page } from '@playwright/test';

export const PASSWORD = 'heslo-pro-vyvoj-12';
const DEV_TOTP_SECRET = 'c2VydmVyby1kZXYtdG90cC1rZXk=';

export async function login(page: Page, email: string, password = PASSWORD) {
	await page.goto('/prihlaseni');
	await page.getByLabel('E-mail').fill(email);
	await page.getByLabel('Heslo').fill(password);
	await page.getByRole('button', { name: 'Přihlásit' }).click();
	// Wait for the result, otherwise a following goto() cancels the form submission.
	await page.waitForLoadState('networkidle');
}

export async function loginAdmin(page: Page) {
	await login(page, 'admin@servero.test');
	await expect(page).toHaveURL(/\/prihlaseni\/overeni/);
	await page.getByLabel('Kód').fill(generateTOTP(decodeBase64(DEV_TOTP_SECRET), 30, 6));
	await page.getByRole('button', { name: 'Ověřit' }).click();
	await expect(page).toHaveURL(/\/admin$/);
}
