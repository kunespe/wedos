import { eq } from 'drizzle-orm';
import { ORIGIN } from '$app/env/private';
import { db } from './db';
import { services } from './db/schema';
import { sendMail } from './mail';
import { paymentRecipients } from './payment-ops';

/** Tells the customer their service is live, with the non-secret connection details the team filled in. */
export async function notifyServiceActive(serviceId: number): Promise<number> {
	const [s] = await db.select().from(services).where(eq(services.id, serviceId));
	if (!s) return 0;
	const to = await paymentRecipients(s.customerId);
	const info = (s.clientInfo ?? []).map((r) => `${r.label}: ${r.value}`).join('\n');
	const text = [
		'Dobrý den,',
		'',
		`vaše služba ${s.label} je zřízená a běží.`,
		info ? `\nPřipojení:\n${info}` : '',
		'',
		`Detail, dostupnost a další požadavky najdete v klientské zóně: ${ORIGIN}/app/sluzby/${s.id}`,
		'Hesla e-mailem neposíláme. Přístup si vyžádáte v klientské zóně požadavkem „Přístup SFTP / SSH“.',
		'',
		'Tým SERVERO'
	].join('\n');
	const sent = await Promise.all(to.map((addr) => sendMail(addr, `SERVERO: ${s.label} běží`, text)));
	return sent.filter(Boolean).length;
}
