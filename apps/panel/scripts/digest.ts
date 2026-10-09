// Morning digest for the team inbox: everything that needs a human today, in one e-mail.
// Run by servero-digest.timer at 07:00 Europe/Prague. Sends nothing on a quiet day unless --always.
// Usage: node --env-file=/etc/servero-panel/env scripts/digest.ts [--always] [--dry-run]
import { and, asc, eq, inArray, isNotNull, lte } from 'drizzle-orm';
import nodemailer from 'nodemailer';
import { createDb } from '../src/lib/server/db/client.ts';
import { customers, domains, orders, paymentRequests, plans, services, tickets } from '../src/lib/server/db/schema.ts';

const env = process.env;
const always = process.argv.includes('--always');
const dryRun = process.argv.includes('--dry-run');
if (!env.DATABASE_URL) throw new Error('DATABASE_URL is not set');
const to = env.ORDER_NOTIFY_EMAIL;
const panel = (env.ORIGIN ?? 'https://panel.serveros.cz').replace(/\/$/, '');

const TZ = 'Europe/Prague';
const today = new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date());
const plusDays = (n: number) => new Date(Date.parse(today + 'T00:00:00Z') + n * 86_400_000).toISOString().slice(0, 10);
const czDate = (iso: string | null) => (iso ? iso.split('-').reverse().map(Number).join('. ') : 'bez data');
const days = (iso: string) => Math.round((Date.parse(iso + 'T00:00:00Z') - Date.parse(today + 'T00:00:00Z')) / 86_400_000);
const hoursAgo = (d: Date) => Math.round((Date.now() - d.getTime()) / 3_600_000);
const money = (n: number) => `${new Intl.NumberFormat('cs-CZ').format(n)} Kč`;

const { db, pool } = createDb(env.DATABASE_URL);

const [openOrders, openTickets, expiring, expiringDomains, unpaid] = await Promise.all([
	db
		.select({ id: orders.id, status: orders.status, name: orders.name, company: orders.company, createdAt: orders.createdAt, plan: plans.name })
		.from(orders)
		.leftJoin(plans, eq(orders.planCode, plans.code))
		.where(inArray(orders.status, ['new', 'contacted', 'provisioning']))
		.orderBy(asc(orders.createdAt)),
	db
		.select({ id: tickets.id, subject: tickets.subject, updatedAt: tickets.updatedAt, customer: customers.name, company: customers.company })
		.from(tickets)
		.innerJoin(customers, eq(tickets.customerId, customers.id))
		.where(eq(tickets.status, 'open'))
		.orderBy(asc(tickets.updatedAt)),
	db
		.select({ id: services.id, label: services.label, expiresAt: services.expiresAt, customer: customers.name })
		.from(services)
		.innerJoin(customers, eq(services.customerId, customers.id))
		.where(and(eq(services.status, 'active'), eq(services.manualHold, false), isNotNull(services.expiresAt), lte(services.expiresAt, plusDays(14))))
		.orderBy(asc(services.expiresAt)),
	db
		.select({ id: domains.id, name: domains.name, expiresAt: domains.expiresAt })
		.from(domains)
		.where(and(eq(domains.managedByUs, true), isNotNull(domains.expiresAt), lte(domains.expiresAt, plusDays(30))))
		.orderBy(asc(domains.expiresAt)),
	db
		.select({ id: paymentRequests.id, vs: paymentRequests.vs, amount: paymentRequests.amount, dueDate: paymentRequests.dueDate, customer: customers.name })
		.from(paymentRequests)
		.innerJoin(customers, eq(paymentRequests.customerId, customers.id))
		.where(and(eq(paymentRequests.status, 'unpaid'), lte(paymentRequests.dueDate, plusDays(3))))
		.orderBy(asc(paymentRequests.dueDate))
]);
await pool.end();

// Firing alerts from Prometheus (sites down, backups, disk). Optional: the digest still works without it.
type Alert = { labels: Record<string, string>; annotations: Record<string, string>; state: string };
let alerts: Alert[] = [];
if (env.PROMETHEUS_URL) {
	try {
		const res = await fetch(`${env.PROMETHEUS_URL.replace(/\/$/, '')}/api/v1/alerts`, { signal: AbortSignal.timeout(5000) });
		alerts = ((await res.json()) as { data: { alerts: Alert[] } }).data.alerts.filter((a) => a.state === 'firing');
	} catch {
		alerts = [{ labels: { alertname: 'MonitoringUnreachable' }, annotations: { summary: 'Prometheus neodpovídá, stav monitoringu neznámý' }, state: 'firing' }];
	}
}

const statusCz: Record<string, string> = { new: 'nová', contacted: 'kontaktováno', provisioning: 'zřizujeme' };
const sections: [string, string[]][] = [
	[
		'Objednávky k vyřízení',
		openOrders.map((o) => `#${o.id} ${o.company || o.name}, ${o.plan ?? 'tarif?'} (${statusCz[o.status]}, ${hoursAgo(o.createdAt)} h): ${panel}/admin/objednavky/${o.id}`)
	],
	['Tikety čekající na naši odpověď', openTickets.map((t) => `#${t.id} ${t.subject} (${t.company || t.customer}, ${hoursAgo(t.updatedAt)} h): ${panel}/admin/tikety/${t.id}`)],
	[
		'Platby po splatnosti nebo do 3 dnů',
		unpaid.map((p) => `VS ${p.vs} ${money(p.amount)}, ${p.customer}, splatnost ${czDate(p.dueDate)}${days(p.dueDate) < 0 ? ' (PO SPLATNOSTI)' : ''}: ${panel}/admin/platby/${p.id}`)
	],
	[
		'Služby: konec předplatného do 14 dnů',
		expiring.map((s) => `${s.label} (${s.customer}), zaplaceno do ${czDate(s.expiresAt)}${days(s.expiresAt!) < 0 ? ' (VYPRŠELO)' : ''}: ${panel}/admin/sluzby/${s.id}`)
	],
	['Domény: expirace do 30 dnů', expiringDomains.map((d) => `${d.name} do ${czDate(d.expiresAt)} (${days(d.expiresAt!)} dní): ${panel}/admin/domeny/${d.id}`)],
	['Monitoring: aktivní upozornění', alerts.map((a) => `${a.labels.alertname}${a.labels.domain ? ` ${a.labels.domain}` : ''}: ${a.annotations.summary ?? ''}`)]
];

const busy = sections.filter(([, rows]) => rows.length);
if (!busy.length && !always) {
	console.log('Digest: nothing to report, no e-mail sent.');
	process.exit(0);
}

const text = [
	`Dobré ráno, přehled SERVEROS na ${czDate(today)}:`,
	'',
	...(busy.length
		? busy.flatMap(([title, rows]) => [`${title} (${rows.length})`, ...rows.map((r) => `  - ${r}`), ''])
		: ['Nic nečeká. Všechny objednávky, tikety a platby jsou vyřízené.', '']),
	`Panel: ${panel}/admin`
].join('\n');
const subject = `SERVEROS ranní přehled: ${busy.map(([t, r]) => `${t.split(':')[0].split(' ')[0]} ${r.length}`).join(', ') || 'vše v pořádku'}`;

if (dryRun || !env.SMTP_URL || !to) {
	console.log(`Subject: ${subject}\nTo: ${to || '(ORDER_NOTIFY_EMAIL not set)'}\n\n${text}`);
	if (!dryRun && (!env.SMTP_URL || !to)) console.log('SMTP_URL or ORDER_NOTIFY_EMAIL missing; printed instead of sending.');
	process.exit(0);
}
await nodemailer.createTransport(env.SMTP_URL).sendMail({
	from: env.MAIL_FROM || 'SERVEROS <info@serveros.cz>',
	replyTo: env.MAIL_REPLY_TO || undefined,
	to,
	subject,
	text
});
console.log(`Digest sent to ${to}: ${subject}`);
