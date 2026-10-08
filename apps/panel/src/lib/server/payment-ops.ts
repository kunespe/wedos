// Queries and e-mails around payment requests shared by the admin and client routes.
import { and, desc, eq, isNotNull, type SQL } from 'drizzle-orm';
import { ORIGIN } from '$app/env/private';
import { czk, date } from '../format';
import { db } from './db/index.ts';
import { customers, paymentRequests, services, users } from './db/schema.ts';
import { sendMail } from './mail.ts';
import { supplier } from './payments.ts';

/** Today's date in Prague as YYYY-MM-DD; a request is overdue once its due date is before this. */
export const todayPrague = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Prague' }).format(new Date());

/** Request rows with customer and service names, for admin tables. */
export function paymentRows(where?: SQL) {
	return db
		.select({
			id: paymentRequests.id,
			vs: paymentRequests.vs,
			customerId: paymentRequests.customerId,
			customer: customers.name,
			company: customers.company,
			serviceId: paymentRequests.serviceId,
			service: services.label,
			description: paymentRequests.description,
			amount: paymentRequests.amount,
			dueDate: paymentRequests.dueDate,
			coversUntil: paymentRequests.coversUntil,
			status: paymentRequests.status,
			paidAt: paymentRequests.paidAt,
			invoiceRef: paymentRequests.invoiceRef,
			remindedAt: paymentRequests.remindedAt,
			createdAt: paymentRequests.createdAt
		})
		.from(paymentRequests)
		.innerJoin(customers, eq(paymentRequests.customerId, customers.id))
		.leftJoin(services, eq(paymentRequests.serviceId, services.id))
		.where(where)
		.orderBy(desc(paymentRequests.createdAt), desc(paymentRequests.id));
}

/**
 * Where a request goes: activated, non-blocked client accounts of the customer,
 * or the customer's contact e-mail when nobody has activated an account yet.
 */
export async function paymentRecipients(customerId: number): Promise<string[]> {
	const rows = await db
		.select({ email: users.email })
		.from(users)
		.where(and(eq(users.customerId, customerId), isNotNull(users.passwordHash), eq(users.disabled, false)));
	if (rows.length) return [...new Set(rows.map((r) => r.email))];
	const [c] = await db.select({ email: customers.email }).from(customers).where(eq(customers.id, customerId));
	return c?.email ? [c.email] : [];
}

/** E-mails the payment instructions for one request. Returns the addresses that were attempted and how many went out. */
export async function mailPaymentRequest(id: number, reminder: boolean) {
	const [p] = await db.select().from(paymentRequests).where(eq(paymentRequests.id, id));
	if (!p) return { to: [] as string[], sent: 0 };
	const to = await paymentRecipients(p.customerId);
	const s = supplier();
	const lines = [
		'Dobrý den,',
		'',
		reminder
			? `připomínáme platbu výzvy ${p.vs}, kterou u nás zatím neevidujeme. Pokud jste už zaplatili, děkujeme a zprávu prosím ignorujte.`
			: `posíláme výzvu k platbě ${p.vs}.`,
		'',
		`Za: ${p.description}`,
		`Částka: ${czk(p.amount)}`,
		`Variabilní symbol: ${p.vs}`,
		`Číslo účtu: ${s.account || 'sdělíme na vyžádání'}`,
		...(s.iban ? [`IBAN: ${s.iban}`] : []),
		`Splatnost: ${date(p.dueDate)}`,
		'',
		'QR kód pro platbu z mobilní aplikace banky a výzvu k vytištění najdete v klientské zóně:',
		`${ORIGIN}/app/platby/${p.id}`,
		'',
		'Po připsání platby vám pošleme daňový doklad.',
		'',
		'Tým SERVERO'
	];
	let sent = 0;
	for (const addr of to) if (await sendMail(addr, `SERVERO: ${reminder ? 'připomínka platby' : 'výzva k platbě'} ${p.vs}`, lines.join('\n'))) sent++;
	return { to, sent };
}
