// Applies pending SQL migrations from ./drizzle. Safe to run on every deploy.
import { migrate } from 'drizzle-orm/mysql2/migrator';
import { createDb } from '../src/lib/server/db/client.ts';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is not set');

const { db, pool } = createDb(url);
await migrate(db, { migrationsFolder: new URL('../drizzle', import.meta.url).pathname });
await pool.end();
console.log('Migrace hotové.');
