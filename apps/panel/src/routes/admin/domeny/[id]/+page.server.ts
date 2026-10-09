import { error, fail, redirect, type RequestEvent } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { audit } from '#lib/server/audit.ts';
import { db } from '#lib/server/db/index.ts';
import { customers, domains } from '#lib/server/db/schema.ts';
import { checkbox, optionalDate, parseForm } from '#lib/server/forms.ts';
import { requireAdmin } from '#lib/server/guards.ts';
import {
	checkDomain,
	contactFromCustomer,
	createContact,
	createDomain,
	domainInfo,
	normalisePhone,
	renewDomain,
	rulesFromName,
	sendAuthInfo,
	tldOf,
	transferCheck,
	transferDomain,
	WapiError,
	wedosStatus,
	type WapiContact
} from '#lib/server/wedos.ts';
import type { Actions, PageServerLoad } from './$types';

async function getDomain(id: number) {
	const [d] = await db.select().from(domains).where(eq(domains.id, id));
	if (!d) error(404, 'Doména neexistuje.');
	return d;
}

async function getCustomer(id: number) {
	const [c] = await db.select().from(customers).where(eq(customers.id, id));
	if (!c) error(404, 'Zákazník neexistuje.');
	return c;
}

export const load: PageServerLoad = async (event) => {
	requireAdmin(event);
	const domain = await getDomain(Number(event.params.id));
	const customer = await getCustomer(domain.customerId);
	const status = wedosStatus();
	const tld = tldOf(domain.name);
	return {
		domain,
		customer,
		wedos: {
			...status,
			tld,
			contactHandle: customer.registryContacts?.[tld] ?? null,
			contactPreview: status.configured ? contactFromCustomer(customer) : null,
			rules: rulesFromName(event.locals.user?.name ?? '')
		}
	};
};

const schema = z.object({
	registrar: z.string().trim().max(60).default('WEDOS'),
	managedByUs: checkbox,
	expiresAt: optionalDate,
	note: z.string().trim().max(4000).transform((v) => v || null)
});

const contactSchema = z.object({
	fname: z.string().trim().min(1, 'Vyplňte jméno.').max(60),
	lname: z.string().trim().min(1, 'Vyplňte příjmení.').max(60),
	company: z.string().trim().max(160).default(''),
	addr_street: z.string().trim().min(1, 'Vyplňte ulici.').max(120),
	addr_city: z.string().trim().min(1, 'Vyplňte město.').max(80),
	addr_zip: z
		.string()
		.trim()
		.transform((v) => v.replace(/\s/g, ''))
		.pipe(z.string().min(3, 'Vyplňte PSČ.').max(12)),
	addr_country: z.string().trim().toLowerCase().regex(/^[a-z]{2}$/, 'Dvoupísmenný kód země, např. cz.'),
	phone: z
		.string()
		.trim()
		.transform((v, ctx) => {
			const p = normalisePhone(v);
			if (p === null) ctx.addIssue({ code: 'custom', message: 'Telefon ve tvaru +420 777000111.' });
			return p ?? '';
		}),
	email: z.string().trim().pipe(z.email('Zadejte platný e-mail.')),
	notify_email: z.string().trim().pipe(z.email('Zadejte platný e-mail.')),
	ident_type: z.enum(['', 'ico', 'op', 'birthday', 'passport', 'mpsv']).default(''),
	ident: z.string().trim().max(40).default(''),
	dic: z.string().trim().max(20).default('')
});

const modeLabel = (test: boolean) => (test ? 'TEST' : 'OSTRÝ');
const czDate = (iso: string) => iso.split('-').reverse().join('. ');

type DomainRow = Awaited<ReturnType<typeof getDomain>>;

/** Shared frame of every WEDOS action: admin only, integration configured, WapiError turned into a form error. */
async function withWedos<T>(event: RequestEvent, run: (domain: DomainRow) => Promise<T>) {
	requireAdmin(event);
	const domain = await getDomain(Number(event.params.id));
	if (!wedosStatus().configured) return fail(400, { error: 'WEDOS není v tomto prostředí nastavený.' });
	try {
		return await run(domain);
	} catch (e) {
		if (e instanceof WapiError) return fail(502, { error: e.message });
		throw e;
	}
}

/** Audits a failed changing call, then rethrows it. Never logs AUTH-ID or credentials. */
async function auditFailure(event: RequestEvent, action: string, subject: string, e: unknown): Promise<never> {
	if (e instanceof WapiError) await audit(event, action, subject, `chyba ${e.code}: ${(e.result || e.message).slice(0, 300)}`);
	throw e;
}

export const actions: Actions = {
	update: async (event) => {
		requireAdmin(event);
		const domain = await getDomain(Number(event.params.id));
		const { data, errors } = parseForm(schema, await event.request.formData());
		if (!data) return fail(400, { errors });
		await db.update(domains).set(data).where(eq(domains.id, domain.id));
		await audit(event, 'domain_update', domain.name, data.expiresAt ? `expirace ${data.expiresAt}` : '');
		return { message: 'Doména uložena.' };
	},
	renew: async (event) => {
		requireAdmin(event);
		const domain = await getDomain(Number(event.params.id));
		// Manual record of a renewal paid at the registrar outside the panel.
		const base = domain.expiresAt ? new Date(domain.expiresAt) : new Date();
		base.setFullYear(base.getFullYear() + 1);
		const next = base.toISOString().slice(0, 10);
		await db.update(domains).set({ expiresAt: next }).where(eq(domains.id, domain.id));
		await audit(event, 'domain_renew', domain.name, `do ${next}`);
		return { message: `Zapsáno prodloužení do ${czDate(next)}.` };
	},
	remove: async (event) => {
		requireAdmin(event);
		const domain = await getDomain(Number(event.params.id));
		await db.delete(domains).where(eq(domains.id, domain.id));
		await audit(event, 'domain_delete', domain.name);
		redirect(303, '/admin/domeny');
	},

	// --- WEDOS: read-only ---------------------------------------------------------------------------------
	wedosInfo: (event) =>
		withWedos(event, async (domain) => {
			const info = await domainInfo(domain.name);
			return { wedos: { kind: 'info' as const, info } };
		}),
	wedosCheck: (event) =>
		withWedos(event, async (domain) => {
			const r = await checkDomain(domain.name);
			return { wedos: { kind: 'check' as const, available: r.available, text: r.message } };
		}),
	wedosSetExpiry: async (event) => {
		requireAdmin(event);
		const domain = await getDomain(Number(event.params.id));
		const exp = optionalDate.safeParse(String((await event.request.formData()).get('expiresAt') ?? ''));
		if (!exp.success || !exp.data) return fail(400, { error: 'Neplatné datum expirace.' });
		await db.update(domains).set({ expiresAt: exp.data }).where(eq(domains.id, domain.id));
		await audit(event, 'domain_update', domain.name, `expirace ${exp.data} (z WEDOS)`);
		return { message: `Expirace zapsána: ${czDate(exp.data)}.` };
	},

	// --- WEDOS: changing commands (WAPI test mode unless WEDOS_WAPI_LIVE=1) ---------------------------------
	wedosContact: (event) =>
		withWedos(event, async (domain) => {
			const customer = await getCustomer(domain.customerId);
			const tld = tldOf(domain.name);
			const { data, errors } = parseForm(contactSchema, await event.request.formData());
			if (!data) return fail(400, { errors, error: 'Zkontrolujte údaje kontaktu.' });
			const contact: WapiContact = data;
			const r = await createContact(tld, contact).catch((e) => auditFailure(event, 'wedos_contact_create', customer.email, e));
			await audit(event, 'wedos_contact_create', customer.email, `${modeLabel(r.test)} · zákazník ${customer.id} · .${tld} · ${r.cname ?? 'bez handle'} · kód ${r.code}`);
			if (r.test) return { message: `Test v pořádku: WEDOS kontakt pro .${tld} ověřil, nic nezaložil.` };
			if (!r.cname) return fail(502, { error: `WEDOS nevrátil handle kontaktu (kód ${r.code}). Zkontrolujte kontakt v administraci WEDOS.` });
			await db
				.update(customers)
				.set({ registryContacts: { ...(customer.registryContacts ?? {}), [tld]: r.cname } })
				.where(eq(customers.id, customer.id));
			return { message: `Kontakt ${r.cname} založen a uložen k zákazníkovi.` };
		}),
	wedosContactHandle: (event) =>
		withWedos(event, async (domain) => {
			const customer = await getCustomer(domain.customerId);
			const tld = tldOf(domain.name);
			const handle = String((await event.request.formData()).get('handle') ?? '').trim().toUpperCase();
			if (!/^[A-Z0-9_.:-]{3,40}$/.test(handle)) return fail(400, { error: 'Neplatný handle kontaktu.' });
			await db
				.update(customers)
				.set({ registryContacts: { ...(customer.registryContacts ?? {}), [tld]: handle } })
				.where(eq(customers.id, customer.id));
			await audit(event, 'wedos_contact_set', customer.email, `zákazník ${customer.id} · .${tld} · ${handle}`);
			return { message: `Kontakt ${handle} uložen k zákazníkovi.` };
		}),
	wedosRegister: (event) =>
		withWedos(event, async (domain) => {
			const customer = await getCustomer(domain.customerId);
			const ownerC = customer.registryContacts?.[tldOf(domain.name)];
			if (!ownerC) return fail(400, { error: 'Zákazník nemá kontakt pro tuto koncovku. Nejdřív založte kontakt.' });
			const check = await checkDomain(domain.name);
			if (!check.available) return fail(400, { error: check.message });
			const rules = rulesFromName(event.locals.user?.name ?? '');
			const r = await createDomain({ name: domain.name, period: 1, ownerC, rules }).catch((e) => auditFailure(event, 'wedos_domain_create', domain.name, e));
			await audit(event, 'wedos_domain_create', domain.name, `${modeLabel(r.test)} · 1 rok · ${ownerC} · kód ${r.code}${r.expiration ? ` · do ${r.expiration}` : ''}`);
			if (r.test) return { message: 'Test v pořádku: WEDOS registraci ověřil, nic nezaregistroval ani nestrhl kredit.' };
			await db
				.update(domains)
				.set({ registrar: 'WEDOS', ...(r.expiration ? { expiresAt: r.expiration } : {}) })
				.where(eq(domains.id, domain.id));
			if (r.pending) return { message: 'WEDOS registraci přijal a zpracovává ji. Stav ověřte za chvíli tlačítkem Načíst stav z WEDOS.' };
			return { message: `Doména zaregistrována${r.expiration ? `, platí do ${czDate(r.expiration)}` : ''}.` };
		}),
	wedosRenew: (event) =>
		withWedos(event, async (domain) => {
			const r = await renewDomain(domain.name, 1).catch((e) => auditFailure(event, 'wedos_domain_renew', domain.name, e));
			await audit(event, 'wedos_domain_renew', domain.name, `${modeLabel(r.test)} · 1 rok · kód ${r.code}${r.expiration ? ` · do ${r.expiration}` : ''}`);
			if (r.test) return { message: 'Test v pořádku: WEDOS prodloužení ověřil, nic neprodloužil ani nestrhl kredit.' };
			if (r.expiration) await db.update(domains).set({ expiresAt: r.expiration }).where(eq(domains.id, domain.id));
			if (!r.expiration) return { message: 'WEDOS prodloužení přijal. Novou expiraci načtěte tlačítkem Načíst stav z WEDOS.' };
			return { message: `Doména prodloužena do ${czDate(r.expiration)}.` };
		}),
	wedosTransfer: (event) =>
		withWedos(event, async (domain) => {
			const authInfo = String((await event.request.formData()).get('authInfo') ?? '').trim();
			if (!authInfo || authInfo.length > 100) return fail(400, { error: 'Vyplňte AUTH-ID (autorizační kód) od současného registrátora.' });
			const check = await transferCheck(domain.name);
			if (!check.possible) return fail(400, { error: check.message });
			const customer = await getCustomer(domain.customerId);
			const ownerC = customer.registryContacts?.[tldOf(domain.name)];
			const rules = rulesFromName(event.locals.user?.name ?? '');
			const r = await transferDomain({ name: domain.name, authInfo, ownerC, rules }).catch((e) => auditFailure(event, 'wedos_domain_transfer', domain.name, e));
			await audit(event, 'wedos_domain_transfer', domain.name, `${modeLabel(r.test)} · ${ownerC ?? 'majitel beze změny'} · kód ${r.code}`);
			if (r.test) return { message: 'Test v pořádku: WEDOS převod ověřil, nic nezahájil ani nestrhl kredit.' };
			await db
				.update(domains)
				.set({ registrar: 'WEDOS', ...(r.expiration ? { expiresAt: r.expiration } : {}) })
				.where(eq(domains.id, domain.id));
			return { message: r.pending ? 'Převod zahájen, WEDOS ho zpracovává. Stav ověřte později tlačítkem Načíst stav z WEDOS.' : 'Převod dokončen.' };
		}),
	wedosSendAuth: (event) =>
		withWedos(event, async (domain) => {
			const r = await sendAuthInfo(domain.name).catch((e) => auditFailure(event, 'wedos_send_auth', domain.name, e));
			await audit(event, 'wedos_send_auth', domain.name, `${modeLabel(r.test)} · kód ${r.code}`);
			if (r.test) return { message: 'Test v pořádku: WEDOS požadavek ověřil, e-mail neodešel.' };
			return { message: 'WEDOS poslal AUTH-ID na e-mail majitele domény.' };
		})
};
