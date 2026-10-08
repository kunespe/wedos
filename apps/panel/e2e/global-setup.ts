import { execFileSync, spawn } from 'node:child_process';
import { existsSync } from 'node:fs';

/** Fresh schema, catalog and fixtures, plus a fake broker on the socket from .env.e2e. */
export default async function setup() {
	const env = { ...process.env };
	const file = ['--env-file=.env.e2e'];
	if (process.env.E2E_DATABASE_URL) env.DATABASE_URL = process.env.E2E_DATABASE_URL;
	const node = (script: string, args: string[] = []) => execFileSync('node', [...file, script, ...args], { env, stdio: 'inherit' });
	node('e2e/reset-db.ts');
	node('scripts/migrate.ts');
	node('scripts/seed.ts');
	node('scripts/dev-fixtures.ts');

	const socket = '/tmp/servero-e2e-broker.sock';
	const broker = spawn('node', ['scripts/fake-broker.ts', socket], { stdio: 'ignore', detached: false });
	for (let i = 0; i < 50 && !existsSync(socket); i++) await new Promise((r) => setTimeout(r, 100));
	return () => broker.kill();
}
