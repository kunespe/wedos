import { DATABASE_URL } from '$app/env/private';
import { createDb } from './client';

export const { db, pool } = createDb(DATABASE_URL);
export * as t from './schema';
