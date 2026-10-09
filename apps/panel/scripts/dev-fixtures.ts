// Local/e2e only: known accounts and sample data. Refuses to run against a non-local database.
// Admin: admin@servero.test / heslo-pro-vyvoj-12 (TOTP: node scripts/totp.ts)
// Client: klient@servero.test / heslo-pro-vyvoj-12
import { and, eq } from 'drizzle-orm';
import { hashPassword } from '../src/lib/server/auth/password.ts';
import { createDb } from '../src/lib/server/db/client.ts';
import { variableSymbol } from '../src/lib/payments.ts';
import { customers, domains, orders, paymentRequests, services, tickets, ticketMessages, users } from '../src/lib/server/db/schema.ts';

export const DEV_TOTP_SECRET = 'c2VydmVyby1kZXYtdG90cC1rZXk=';
const PASSWORD = 'heslo-pro-vyvoj-12';

const url = process.env.DATABASE_URL ?? '';
if (!/@(127\.0\.0\.1|localhost)[:/]/.test(url)) throw new Error('dev-fixtures only run against a local database');
const { db, pool } = createDb(url);
const hash = await hashPassword(PASSWORD);

async function upsertUser(email: string, values: Omit<typeof users.$inferInsert, 'email'>) {
	const [u] = await db.select().from(users).where(eq(users.email, email));
	if (u) {
		await db.update(users).set(values).where(eq(users.id, u.id));
		return u.id;
	}
	const [{ id }] = await db.insert(users).values({ email, ...values }).$returningId();
	return id;
}

const adminId = await upsertUser('admin@servero.test', { name: 'Petr Kuneš', role: 'admin', passwordHash: hash, totpSecret: DEV_TOTP_SECRET });

let [customer] = await db.select().from(customers).where(eq(customers.email, 'klient@servero.test'));
if (!customer) {
	const [{ id }] = await db
		.insert(customers)
		.values({ name: 'Jana Nováková', company: 'Centrum Arete z.s.', ico: '22746862', address: 'Plzeň', email: 'klient@servero.test', phone: '+420 777 000 111' })
		.$returningId();
	[customer] = await db.select().from(customers).where(eq(customers.id, id));
	await db.insert(services).values([
		{ customerId: id, planCode: 'wp-provoz', kind: 'wp', label: 'WP Provoz · centrumarete.cz', domain: 'centrumarete.cz', nodeId: 1, status: 'active', period: 'year', priceMonthly: 349, cloudpanelSite: 'centrumarete.cz', fakturorSubscriptionId: 101, expiresAt: '2027-03-31' },
		{ customerId: id, planCode: 'web-start', kind: 'web', label: 'Web Start · arete-akce.cz', domain: 'arete-akce.cz', nodeId: 1, status: 'pending', period: 'year', priceMonthly: 79 }
	]);
	await db.insert(domains).values({ customerId: id, name: 'centrumarete.cz', registrar: 'Subreg', managedByUs: true, expiresAt: '2026-10-28' });
	const [{ id: ticketId }] = await db.insert(tickets).values({ customerId: id, subject: 'Nefunguje kontaktní formulář', status: 'open' }).$returningId();
	await db.insert(ticketMessages).values({ ticketId, body: 'Dobrý den, od včera nechodí zprávy z formuláře na webu.' });
	await db.insert(orders).values([
		{ planCode: 'vps-m', period: 'month', name: 'Tomáš Beneš', email: 'tomas@stavby-benes.cz', company: 'Stavby Beneš s.r.o.', ico: '27082440', domainMode: 'none', priceMonthly: 2190, note: 'Potřebujeme přestěhovat interní aplikaci z AWS.' },
		{ planCode: 'web-plus', period: 'year', name: 'Lucie Malá', email: 'lucie@kvetinarstvi-mala.cz', domain: 'kvetinarstvi-mala.cz', domainMode: 'register', priceMonthly: 149 }
	]);
}
await upsertUser('klient@servero.test', { name: 'Jana Nováková', role: 'client', customerId: customer.id, passwordHash: hash, totpSecret: null });

// Payment requests: last year's paid renewal and an open one for the next period. Only when the customer has none.
const [anyRequest] = await db.select({ id: paymentRequests.id }).from(paymentRequests).where(eq(paymentRequests.customerId, customer.id)).limit(1);
const [wp] = await db
	.select()
	.from(services)
	.where(and(eq(services.customerId, customer.id), eq(services.domain, 'centrumarete.cz')));
if (!anyRequest && wp) {
	const iso = (d: Date) => d.toISOString().slice(0, 10);
	const net = (wp.priceMonthly ?? 349) * 10;
	// Placeholder variable symbols until the row id is known, as in createPaymentRequest.
	let id0 = Date.now() % 1e6;
	const addRequest = async (values: Omit<typeof paymentRequests.$inferInsert, 'vs' | 'customerId' | 'serviceId' | 'net' | 'amount' | 'vatRate'>) => {
		const [{ id }] = await db
			.insert(paymentRequests)
			.values({ vs: `tmp${id0++}`, customerId: customer.id, serviceId: wp.id, net, vatRate: 0, amount: net, createdById: adminId, ...values })
			.$returningId();
		await db.update(paymentRequests).set({ vs: variableSymbol(id) }).where(eq(paymentRequests.id, id));
	};
	await addRequest({
		description: `${wp.label}, prodloužení do 31. 3. 2027`,
		dueDate: '2026-03-20',
		coversUntil: '2027-03-31',
		status: 'paid',
		paidAt: new Date('2026-03-12T09:30:00Z'),
		invoiceRef: 'FA-2026-0042'
	});
	await addRequest({
		description: `${wp.label}, prodloužení do 31. 3. 2028`,
		dueDate: iso(new Date(Date.now() + 14 * 86_400_000)),
		coversUntil: '2028-03-31'
	});
}
await pool.end();
console.log('Fixtures ready. admin %d, customer %d', adminId, customer.id);
