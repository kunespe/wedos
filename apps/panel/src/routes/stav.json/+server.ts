import { json, type RequestHandler } from '@sveltejs/kit';
import { publicGetCors } from '#lib/server/public-api.ts';
import { publicStatus } from '#lib/server/status.ts';

export const OPTIONS: RequestHandler = () => new Response(null, { status: 204, headers: publicGetCors });

/** Aggregate status for the serveros.cz status bars. Same data as /stav, cached 60 s server-side. */
export const GET: RequestHandler = async () =>
	json(await publicStatus(), { headers: { ...publicGetCors, 'Cache-Control': 'public, max-age=60' } });
