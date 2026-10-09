import { defineConfig } from 'vitest/config';

// Unit and DB integration tests for plain TS modules; route behaviour is covered by Playwright.
// DB tests use TEST_DATABASE_URL and are skipped without it.
export default defineConfig({
	resolve: {
		alias: {
			'#lib': new URL('./src/lib', import.meta.url).pathname,
			'$app/env/private': new URL('./src/test/env-stub.ts', import.meta.url).pathname
		}
	},
	test: { include: ['src/**/*.test.ts'], environment: 'node', fileParallelism: false }
});
