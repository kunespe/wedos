import { eq } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/mysql2/migrator';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createDb } from './db/client';
import { customers, domains, invites, nodes, orders, paymentRequests, plans, services, ticketMessages, tickets, users } from './db/schema';
import { convertOrder, FulfilmentError } from './fulfilment';

const url = process.env.TEST_DATABASE_URL;
const { db, pool } = url ? createDb(url) : ({} as ReturnType<typeof createDb>);

describe.skipIf(!url)('convertOrder', () => {
	beforeAll(async () => {
		await migrate(db, { migrationsFolder: new URL('../../../drizzle', import.meta.url).pathname });
	});
	afterAll(() => pool.end());
	beforeEach(async () => {
		for (const t of [paymentRequests, ticketMessages, tickets, invites, services, domains, orders, users, customers, nodes, plans]) await db.delete(t);
		await db.insert(plans).values([
			{ code: 'web-plus', category: 'hosting', kind: 'web', name: 'Web Plus', monthly: 149, features: [] },
			{ code: 'domeny', category: 'domains', kind: 'domain', name: 'Registrace domén', monthly: null, features: [] }
		]);
		await db.insert(nodes).values({ id: 1, name: 'n1', host: '127.0.0.1', local: true });
	});

	const order = (extra: Partial<typeof orders.$inferInsert> = {}) =>
		db
			.insert(orders)
			.values({ planCode: 'web-plus', period: 'year', name: 'Lucie Malá', email: 'lucie@example.cz', domain: 'kvetiny.cz', domainMode: 'register', priceMonthly: 149, ...extra })
			.$returningId()
			.then((r) => r[0].id);

	it('creates customer, client login, pending service, domain and invite', async () => {
		const id = await order();
		const r = await convertOrder(db, id, 1);
		expect(r.createdCustomer).toBe(true);
		expect(r.inviteToken).toMatch(/^[a-z2-7]{32}$/);
		const [s] = await db.select().from(services).where(eq(services.id, r.serviceId!));
		expect(s).toMatchObject({ status: 'pending', kind: 'web', domain: 'kvetiny.cz', nodeId: 1, priceMonthly: 149, orderId: id });
		const [u] = await db.select().from(users).where(eq(users.id, r.userId));
		expect(u).toMatchObject({ role: 'client', customerId: r.customerId, passwordHash: null });
		expect(await db.select().from(domains)).toHaveLength(1);
		const [o] = await db.select().from(orders).where(eq(orders.id, id));
		expect(o).toMatchObject({ status: 'provisioning', customerId: r.customerId });
	});

	it('reuses the customer for a repeat order and refuses double conversion', async () => {
		const first = await convertOrder(db, await order(), 1);
		const secondId = await order({ domain: 'druhy.cz', domainMode: 'own' });
		const second = await convertOrder(db, secondId, 1);
		expect(second.customerId).toBe(first.customerId);
		expect(second.createdCustomer).toBe(false);
		expect(await db.select().from(customers)).toHaveLength(1);
		await expect(convertOrder(db, secondId, 1)).rejects.toBeInstanceOf(FulfilmentError);
	});

	it('refuses an e-mail that belongs to an admin', async () => {
		await db.insert(users).values({ email: 'lucie@example.cz', name: 'Admin', role: 'admin' });
		await expect(convertOrder(db, await order(), 1)).rejects.toThrow(/správci/);
		expect(await db.select().from(services)).toHaveLength(0);
	});

	it('attaches a panel order to its customer without creating a login', async () => {
		const [{ id: customerId }] = await db.insert(customers).values({ name: 'Jana Nováková', email: 'jana@firma.cz' }).$returningId();
		const [{ id: userId }] = await db
			.insert(users)
			.values({ email: 'jana@firma.cz', name: 'Jana Nováková', role: 'client', customerId, passwordHash: 'x' })
			.$returningId();
		// The contact e-mail differs on purpose: a panel order must not be matched by e-mail.
		const id = await order({ source: 'panel', customerId, email: 'fakturace@firma.cz', domain: 'nova.cz', domainMode: 'own' });
		const r = await convertOrder(db, id, 1);
		expect(r).toMatchObject({ customerId, userId, inviteToken: null, createdCustomer: false });
		expect(await db.select().from(customers)).toHaveLength(1);
		expect(await db.select().from(users)).toHaveLength(1);
		const [s] = await db.select().from(services).where(eq(services.id, r.serviceId!));
		expect(s).toMatchObject({ customerId, status: 'pending', orderId: id, domain: 'nova.cz' });
		const [o] = await db.select().from(orders).where(eq(orders.id, id));
		expect(o.status).toBe('provisioning');
		await expect(convertOrder(db, id, 1)).rejects.toThrow(/převedená/);
	});

	it('turns a basket into domain rows next to the hosting service, skipping names we already hold', async () => {
		const [{ id: otherId }] = await db.insert(customers).values({ name: 'Někdo Jiný', email: 'jiny@example.cz' }).$returningId();
		await db.insert(domains).values({ customerId: otherId, name: 'obsazena.cz' });
		const id = await order({
			domains: [
				{ name: 'kvetiny.cz', mode: 'register', years: 1, price: 249 },
				{ name: 'kvetiny.eu', mode: 'register', years: 2, price: null },
				{ name: 'stara-firma.com', mode: 'transfer', years: 1, price: null },
				{ name: 'obsazena.cz', mode: 'register', years: 1, price: 249 }
			]
		});
		const r = await convertOrder(db, id, 1);
		expect(r.serviceId).not.toBeNull();
		expect(r.createdDomains).toEqual(['kvetiny.eu', 'stara-firma.com']);
		expect(r.skippedDomains).toEqual(['obsazena.cz']);
		const rows = await db.select().from(domains).where(eq(domains.customerId, r.customerId));
		expect(rows.map((d) => d.name).sort()).toEqual(['kvetiny.cz', 'kvetiny.eu', 'stara-firma.com']);
		expect(rows.find((d) => d.name === 'stara-firma.com')).toMatchObject({ managedByUs: true, registrar: 'Subreg', expiresAt: null, note: `Převod z objednávky #${id}` });
		expect(rows.find((d) => d.name === 'kvetiny.eu')?.note).toBe(`Registrace z objednávky #${id}`);
	});

	it('converts a domain-only order without a service, once', async () => {
		const id = await order({
			planCode: 'domeny',
			priceMonthly: null,
			domain: '',
			domainMode: 'none',
			domains: [{ name: 'jen-domena.cz', mode: 'register', years: 3, price: 249 }]
		});
		const r = await convertOrder(db, id, 1);
		expect(r).toMatchObject({ serviceId: null, createdCustomer: true, createdDomains: ['jen-domena.cz'] });
		expect(await db.select().from(services)).toHaveLength(0);
		const [o] = await db.select().from(orders).where(eq(orders.id, id));
		expect(o).toMatchObject({ status: 'provisioning', customerId: r.customerId });
		expect(o.convertedAt).toBeInstanceOf(Date);
		await expect(convertOrder(db, id, 1)).rejects.toThrow(/převedená/);
	});

	it('refuses to convert a domain-only panel order twice', async () => {
		const [{ id: customerId }] = await db.insert(customers).values({ name: 'Jana Nováková', email: 'jana@firma.cz' }).$returningId();
		await db.insert(users).values({ email: 'jana@firma.cz', name: 'Jana Nováková', role: 'client', customerId, passwordHash: 'x' });
		const id = await order({ source: 'panel', customerId, planCode: 'domeny', priceMonthly: null, domain: '', domainMode: 'none', domains: [{ name: 'panel-domena.cz', mode: 'transfer', years: 1, price: 249 }] });
		const r = await convertOrder(db, id, 1);
		expect(r).toMatchObject({ customerId, serviceId: null, inviteToken: null, createdDomains: ['panel-domena.cz'] });
		await expect(convertOrder(db, id, 1)).rejects.toThrow(/převedená/);
	});
});
