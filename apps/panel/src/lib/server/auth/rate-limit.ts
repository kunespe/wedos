import { and, eq, gt, lt, sql } from 'drizzle-orm';
import { db } from '../db';
import { loginFailures } from '../db/schema';

const WINDOW = 15 * 60 * 1000;
const MAX_FAILURES = 8;

export async function tooManyFailures(ip: string): Promise<boolean> {
	const [{ count }] = await db
		.select({ count: sql<number>`count(*)` })
		.from(loginFailures)
		.where(and(eq(loginFailures.ip, ip), gt(loginFailures.at, new Date(Date.now() - WINDOW))));
	return Number(count) >= MAX_FAILURES;
}

export async function recordFailure(ip: string, email: string) {
	await db.insert(loginFailures).values({ ip, email: email.slice(0, 254) });
	await db.delete(loginFailures).where(lt(loginFailures.at, new Date(Date.now() - 24 * 60 * 60 * 1000)));
}

export const clearFailures = (ip: string) => db.delete(loginFailures).where(eq(loginFailures.ip, ip));
