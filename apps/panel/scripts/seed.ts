// Upserts the price catalog from catalog/plans.json and makes sure the local node exists.
// Usage: pnpm db:seed [path/to/plans.json]
import { readFileSync } from 'node:fs';
import { sql } from 'drizzle-orm';
import { createDb } from '../src/lib/server/db/client.ts';
import { nodes, plans } from '../src/lib/server/db/schema.ts';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is not set');

const file = process.argv[2] ?? new URL('../../../catalog/plans.json', import.meta.url).pathname;
const catalog = JSON.parse(readFileSync(file, 'utf8')) as {
	plans: { code: string; category: string; kind: 'web'; name: string; monthly: number | null; from?: boolean; features: string[] }[];
};

const { db, pool } = createDb(url);
for (const [sort, p] of catalog.plans.entries()) {
	const row = {
		category: p.category,
		kind: p.kind,
		name: p.name,
		monthly: p.monthly,
		priceFrom: Boolean(p.from),
		features: p.features,
		active: true,
		sort
	};
	await db.insert(plans).values({ code: p.code, ...row }).onDuplicateKeyUpdate({ set: row });
}
// Plans removed from the catalog stay for history but cannot be ordered.
const codes = catalog.plans.map((p) => p.code);
await db.update(plans).set({ active: false }).where(sql`${plans.code} not in ${codes}`);

const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(nodes);
if (Number(count) === 0) {
	await db.insert(nodes).values({ name: 'vytvorit-web', host: '2.31.25.249', provider: 'Hetzner Cloud', location: 'DE', local: true });
}
await pool.end();
console.log(`Ceník: ${catalog.plans.length} tarifů.`);
