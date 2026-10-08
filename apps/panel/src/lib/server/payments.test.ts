import { eq } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/mysql2/migrator';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createDb } from './db/client';
import { customers, domains, invites, nodes, orders, paymentRequests, plans, services, ticketMessages, tickets, users } from './db/schema';
import { createRenewalRequest, markPaid, PaymentError } from './payments';

const url = process.env.TEST_DATABASE_URL;
const { db, pool } = url ? createDb(url) : ({} as ReturnType<typeof createDb>);

describe.skipIf(!url)('payment requests', () => {
	let serviceId = 0;
	beforeAll(async () => {
		await migrate(db, { migrationsFolder: new URL('../../../drizzle', import.meta.url).pathname });
	});
	afterAll(() => pool.end());
	beforeEach(async () => {
		for (const t of [paymentRequests, ticketMessages, tickets, invites, services, domains, orders, users, customers, nodes, plans]) await db.delete(t);
		const [{ id: c }] = await db.insert(customers).values({ name: 'Jana', email: 'jana@example.cz' }).$returningId();
		[{ id: serviceId }] = await db
			.insert(services)
			.values({ customerId: c, kind: 'wp', label: 'WP Provoz · jana.cz', status: 'active', period: 'year', priceMonthly: 349, expiresAt: '2099-03-31' })
			.$returningId();
	});

	it('creates a yearly renewal for ten months and extends the service when paid', async () => {
		const { id, vs } = await createRenewalRequest(db, serviceId, null);
		expect(vs).toMatch(/^\d{8}$/);
		const [p] = await db.select().from(paymentRequests).where(eq(paymentRequests.id, id));
		expect(p).toMatchObject({ net: 3490, amount: 3490, coversUntil: '2100-03-31', status: 'unpaid' });
		await expect(createRenewalRequest(db, serviceId, null)).rejects.toBeInstanceOf(PaymentError);

		expect(await markPaid(db, id, 'FA-2026-001')).toEqual({ extended: '2100-03-31', serviceId });
		const [s] = await db.select().from(services).where(eq(services.id, serviceId));
		expect(s.expiresAt).toBe('2100-03-31');
		await expect(markPaid(db, id)).rejects.toThrow(/není k úhradě/);
	});

	it('refuses a service without a price', async () => {
		await db.update(services).set({ priceMonthly: null }).where(eq(services.id, serviceId));
		await expect(createRenewalRequest(db, serviceId, null)).rejects.toThrow(/cenu/);
	});
});
