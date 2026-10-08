import type { RequestHandler } from '@sveltejs/kit';
import { sql } from 'drizzle-orm';
import { db } from '#lib/server/db/index.ts';

/** Health check for deploy scripts and the uptime probe. */
export const GET: RequestHandler = async () => {
	try {
		await db.execute(sql`select 1`);
		return new Response('ok\n', { headers: { 'Cache-Control': 'no-store' } });
	} catch {
		return new Response('db\n', { status: 503 });
	}
};
