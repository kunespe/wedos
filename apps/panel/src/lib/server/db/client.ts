import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import * as schema from './schema.ts';

export function createDb(url: string) {
	const pool = mysql.createPool({ uri: url, connectionLimit: 5, timezone: 'Z', dateStrings: false });
	return { db: drizzle(pool, { schema, mode: 'default' }), pool };
}

export type Db = ReturnType<typeof createDb>['db'];
