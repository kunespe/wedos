import { and, eq, or } from 'drizzle-orm';
import { createInvite } from './auth/invites';
import type { Db } from './db/client';
import { customers, domains, orders, plans, services, users } from './db/schema';

export class FulfilmentError extends Error {}

/**
 * Turns an order into a customer, a client login and a pending service.
 * Nothing is provisioned here: the team sets the server up by hand and then marks the service active.
 * Re-uses an existing customer matched by e-mail or IČO so repeat customers keep one account.
 */
export async function convertOrder(db: Db, orderId: number, nodeId: number | null) {
	return db.transaction(async (tx) => {
		const [order] = await tx.select().from(orders).where(eq(orders.id, orderId)).for('update');
		if (!order) throw new FulfilmentError('Objednávka neexistuje.');
		if (order.customerId) throw new FulfilmentError('Objednávka už je převedená.');
		if (order.status === 'cancelled' || order.status === 'done') throw new FulfilmentError('Objednávka je uzavřená.');
		const [plan] = await tx.select().from(plans).where(eq(plans.code, order.planCode));

		const match = [eq(customers.email, order.email)];
		if (order.ico) match.push(eq(customers.ico, order.ico));
		let [customer] = await tx.select().from(customers).where(or(...match)).limit(1);
		const createdCustomer = !customer;
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

		let [user] = await tx.select().from(users).where(eq(users.email, order.email));
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

		const kind = plan?.kind ?? 'web';
		const [{ id: serviceId }] = await tx
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

		if (order.domain && order.domainMode === 'register') {
			const [existing] = await tx.select().from(domains).where(eq(domains.name, order.domain));
			if (!existing) await tx.insert(domains).values({ customerId: customer.id, name: order.domain, managedByUs: true });
		}

		await tx
			.update(orders)
			.set({ customerId: customer.id, status: 'provisioning' })
			.where(and(eq(orders.id, order.id)));

		// A password-less user gets a fresh invite; an existing login keeps working as is.
		const inviteToken = user.passwordHash ? null : await createInvite(tx as unknown as Db, user.id, 'invite');
		return { customerId: customer.id, serviceId, userId: user.id, inviteToken, createdCustomer };
	});
}
