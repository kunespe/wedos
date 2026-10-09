// One-off: turns the sites the legacy dashboard manages (CloudPanel + state.json, read through the broker
// snapshot) into panel customers and services. Dry run by default; pass --apply to write.
// Usage on the server: sudo -u servero-panel pnpm import:legacy [--apply]
import { createConnection } from 'node:net';
import { eq } from 'drizzle-orm';
import { createDb } from '../src/lib/server/db/client.ts';
import { customers, nodes, services } from '../src/lib/server/db/schema.ts';

const apply = process.argv.includes('--apply');
const url = process.env.DATABASE_URL;
const socketPath = process.env.BROKER_SOCKET;
if (!url || !socketPath) throw new Error('DATABASE_URL and BROKER_SOCKET must be set');

type Site = {
	domain_name: string;
	type: string;
	application: string;
	management: { client?: string; expires_at?: string; manual_hold?: boolean; kind?: string; suspended?: boolean; subscription_id?: number | null };
	billing_status: { subscription?: { expires_on: string } };
};

const snapshot = await new Promise<{ sites: Site[] }>((resolve, reject) => {
	const s = createConnection(socketPath);
	let buf = '';
	s.on('connect', () => s.write(JSON.stringify({ op: 'snapshot', data: {} }) + '\n'));
	s.on('data', (c) => {
		buf += c;
		if (!buf.endsWith('\n')) return;
		s.end();
		const r = JSON.parse(buf);
		if (r.ok) resolve(r.data);
		else reject(new Error(r.error));
	});
	s.on('error', reject);
});

const { db, pool } = createDb(url);
const [node] = await db.select().from(nodes).where(eq(nodes.local, true));
if (!node) throw new Error('Run pnpm db:seed first (local node missing).');

let created = 0;
for (const site of snapshot.sites) {
	const domain = site.domain_name;
	const [existing] = await db.select({ id: services.id }).from(services).where(eq(services.cloudpanelSite, domain));
	if (existing) {
		console.log(`= ${domain}: už je služba #${existing.id}`);
		continue;
	}
	const m = site.management ?? {};
	const isWp = (m.kind ?? site.application ?? '').toLowerCase().includes('wordpress');
	const kind = isWp ? 'wp' : ['nodejs', 'bun', 'reverse-proxy'].includes((m.kind ?? site.type).toLowerCase()) ? 'app' : 'web';
	const clientName = (m.client || domain).trim();
	const expiresAt = site.billing_status?.subscription?.expires_on || m.expires_at || null;
	console.log(`+ ${domain}: ${kind}, zákazník „${clientName}“, do ${expiresAt ?? '?'}${m.suspended ? ', POZASTAVENO' : ''}`);
	if (!apply) continue;

	// Legacy records carry only a client name; e-mail and IČO are filled in by hand afterwards.
	let [customer] = await db.select().from(customers).where(eq(customers.name, clientName));
	if (!customer) {
		const [{ id }] = await db
			.insert(customers)
			.values({ name: clientName, email: `doplnit+${domain}@serveros.cz`, note: 'Převzato z Vytvořit web. Doplňte kontakt a IČO.' })
			.$returningId();
		[customer] = await db.select().from(customers).where(eq(customers.id, id));
	}
	await db.insert(services).values({
		customerId: customer.id,
		planCode: isWp ? 'wp-provoz' : kind === 'app' ? 'app-node' : 'web-start',
		kind,
		label: `${isWp ? 'WordPress' : kind === 'app' ? 'Aplikace' : 'Web'} · ${domain}`,
		domain,
		nodeId: node.id,
		status: m.suspended ? 'suspended' : 'active',
		period: 'year',
		// Legacy prices were agreed individually; fill in from Fakturor.
		priceMonthly: null,
		cloudpanelSite: domain,
		fakturorSubscriptionId: m.subscription_id ?? null,
		expiresAt,
		manualHold: m.manual_hold === true,
		note: 'Importováno z legacy dashboardu.'
	});
	created++;
}
await pool.end();
console.log(apply ? `Hotovo, založeno ${created} služeb.` : 'Zkušební běh, nic se nezapsalo. Pro zápis přidejte --apply.');
