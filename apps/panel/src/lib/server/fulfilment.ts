import { and, eq, inArray, or } from 'drizzle-orm';
import { NON_HOSTING_CATEGORIES } from '../orders';
import { createInvite } from './auth/invites';
import type { Db } from './db/client';
import { customers, domains, orders, plans, services, users } from './db/schema';

export class FulfilmentError extends Error {}

/**
 * Turns an order into a customer, a client login and a pending service.
 * Nothing is provisioned here: the team sets the server up by hand and then marks the service active.
 * Re-uses an existing customer matched by e-mail or IČO so repeat customers keep one account.
 * A panel order (customerId set by a logged-in client) attaches the service to that customer directly.
 * Every domain in the basket becomes a domains row (names someone already holds with us are skipped);
 * an order with domains only creates no service at all.
 */
export async function convertOrder(db: Db, orderId: number, nodeId: number | null) {
	return db.transaction(async (tx) => {
		const [order] = await tx.select().from(orders).where(eq(orders.id, orderId)).for('update');
		if (!order) throw new FulfilmentError('Objednávka neexistuje.');
		// A panel order carries its customer from the start, so "converted" means a service already exists.
		const [existing] = await tx.select({ id: services.id }).from(services).where(eq(services.orderId, order.id)).limit(1);
		if (existing || order.convertedAt || (order.customerId && order.source !== 'panel')) throw new FulfilmentError('Objednávka už je převedená.');
		if (order.status === 'cancelled' || order.status === 'done') throw new FulfilmentError('Objednávka je uzavřená.');
		const [plan] = await tx.select().from(plans).where(eq(plans.code, order.planCode));

		let customer: typeof customers.$inferSelect | undefined;
		let user: typeof users.$inferSelect | undefined;
		let createdCustomer = false;
		if (order.customerId) {
			// Ordered by a logged-in customer: attach to that account; their login already exists.
			[customer] = await tx.select().from(customers).where(eq(customers.id, order.customerId));
			if (!customer) throw new FulfilmentError('Zákazník objednávky už neexistuje.');
			[user] = await tx.select().from(users).where(and(eq(users.customerId, customer.id), eq(users.role, 'client'))).limit(1);
		} else {
			const match = [eq(customers.email, order.email)];
			if (order.ico) match.push(eq(customers.ico, order.ico));
			[customer] = await tx.select().from(customers).where(or(...match)).limit(1);
			createdCustomer = !customer;
			if (!customer) {
				const [{ id }] = await tx
					.insert(customers)
					.values({
						name: order.name,
						company: order.company,
						ico: order.ico,
						dic: order.dic,
						address: order.address,
						email: order.email,
						phone: order.phone
					})
				.$returningId();
				[customer] = await tx.select().from(customers).where(eq(customers.id, id));
			}

			[user] = await tx.select().from(users).where(eq(users.email, order.email));
			if (user && user.role === 'admin') throw new FulfilmentError('E-mail patří správci; zákazník potřebuje jiný.');
			if (user && user.customerId !== customer.id)
				throw new FulfilmentError('E-mail už má účet u jiného zákazníka. Vyřešte ručně.');
			if (!user) {
				const [{ id }] = await tx
					.insert(users)
					.values({ email: order.email, name: order.name, role: 'client', customerId: customer.id })
				.$returningId();
				[user] = await tx.select().from(users).where(eq(users.id, id));
			}
		}

		const domainOnly = !!plan && NON_HOSTING_CATEGORIES.includes(plan.category);
		const kind = plan?.kind ?? 'web';
		let serviceId: number | null = null;
		if (!domainOnly) {
			[{ id: serviceId }] = await tx
				.insert(services)
				.values({
					customerId: customer.id,
					planCode: plan?.code ?? null,
					kind,
					label: plan ? `${plan.name}${order.domain ? ` · ${order.domain}` : ''}` : order.planCode,
					domain: order.domain,
					nodeId: kind === 'vps' || kind === 'management' ? null : nodeId,
					status: 'pending',
					period: order.period,
					priceMonthly: order.priceMonthly,
					cloudpanelSite: '',
					orderId: order.id
				})
				.$returningId();
		}

		if (order.domain && order.domainMode === 'register') {
			const [existing] = await tx.select().from(domains).where(eq(domains.name, order.domain));
			if (!existing) await tx.insert(domains).values({ customerId: customer.id, name: order.domain, registrar: 'WEDOS', managedByUs: true });
		}

		// The basket: one row per domain, registrar and expiry are filled in by hand once the registry confirms.
		const basket = order.domains ?? [];
		const taken = basket.length
			? new Set(
					(await tx.select({ name: domains.name }).from(domains).where(inArray(domains.name, basket.map((d) => d.name)))).map((d) => d.name)
				)
			: new Set<string>();
		const createdDomains: string[] = [];
		const skippedDomains: string[] = [];
		for (const d of basket) {
			if (taken.has(d.name)) {
				// the hosting domain registered just above is not a conflict
				if (!(d.name === order.domain && order.domainMode === 'register')) skippedDomains.push(d.name);
				continue;
			}
			taken.add(d.name);
			await tx.insert(domains).values({
				customerId: customer.id,
				name: d.name,
				registrar: 'WEDOS',
				managedByUs: true,
				expiresAt: null,
				note: `${d.mode === 'transfer' ? 'Převod' : 'Registrace'} z objednávky #${order.id}`
			});
			createdDomains.push(d.name);
		}

		await tx
			.update(orders)
			.set({ customerId: customer.id, status: 'provisioning', convertedAt: new Date() })
			.where(and(eq(orders.id, order.id)));

		// A password-less user gets a fresh invite; an existing login (always the case for panel orders) keeps working as is.
		const inviteToken = order.customerId || !user || user.passwordHash ? null : await createInvite(tx as unknown as Db, user.id, 'invite');
		return { customerId: customer.id, serviceId, userId: user?.id ?? null, inviteToken, createdCustomer, createdDomains, skippedDomains };
	});
}
