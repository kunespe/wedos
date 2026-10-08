import { eq } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/mysql2/migrator';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createDb } from './db/client';
import { customers, domains, invites, nodes, orders, plans, services, users } from './db/schema';
import { convertOrder, FulfilmentError } from './fulfilment';

const url = process.env.TEST_DATABASE_URL;
const { db, pool } = url ? createDb(url) : ({} as ReturnType<typeof createDb>);

describe.skipIf(!url)('convertOrder', () => {
	beforeAll(async () => {
		await migrate(db, { migrationsFolder: new URL('../../../drizzle', import.meta.url).pathname });
	});
	afterAll(() => pool.end());
	beforeEach(async () => {
		for (const t of [invites, services, domains, orders, users, customers, nodes, plans]) await db.delete(t);
		await db.insert(plans).values({ code: 'web-plus', category: 'hosting', kind: 'web', name: 'Web Plus', monthly: 149, features: [] });
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
		const [s] = await db.select().from(services).where(eq(services.id, r.serviceId));
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
});
