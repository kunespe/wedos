import { defineConfig } from '@playwright/test';

// Runs the production build against a throwaway database and the fake broker (see e2e/global-setup.ts).
export default defineConfig({
	testDir: 'e2e',
	fullyParallel: false,
	workers: 1,
	retries: process.env.CI ? 1 : 0,
	reporter: process.env.CI ? [['github'], ['list']] : 'list',
	globalSetup: './e2e/global-setup.ts',
	// The build assumes https unless told otherwise (PROTOCOL_HEADER in .env.e2e).
	use: { baseURL: 'http://127.0.0.1:4173', extraHTTPHeaders: { 'x-forwarded-proto': 'http' }, locale: 'cs-CZ', timezoneId: 'Europe/Prague', trace: 'retain-on-failure' },
	webServer: {
		command: 'node --env-file=.env.e2e build/index.js',
		url: 'http://127.0.0.1:4173/zdravi',
		reuseExistingServer: false,
		timeout: 60_000,
		env: process.env.E2E_DATABASE_URL ? { DATABASE_URL: process.env.E2E_DATABASE_URL } : {}
	}
});
