import { fail, type RequestEvent } from '@sveltejs/kit';
import { ZodError, z } from 'zod';
import { requireAdmin } from '#lib/server/guards.ts';
import { audit } from '#lib/server/audit.ts';
import { createMailAlias, createMailDomain, createMailMailbox, mailcowSnapshot, mailcowStatus, MailcowError, mailDomain, mailDomainDns, mailboxAddress, mailboxPassword, mailboxQuota, localPart, updateMailMailbox } from '#lib/server/mailcow.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	requireAdmin(event);
	const status = mailcowStatus();
	if (!status.configured) return { status, mail: null, error: null };
	try { return { status, mail: await mailcowSnapshot(), error: null }; }
	catch (e) { if (e instanceof MailcowError) return { status, mail: null, error: e.message }; throw e; }
};

async function change(event: RequestEvent, run: (form: FormData) => Promise<{ action: string; subject: string; message: string }>) {
	requireAdmin(event);
	try {
		const result = await run(await event.request.formData());
		await audit(event, result.action, result.subject);
		return { message: result.message };
	} catch (e) {
		if (e instanceof ZodError) return fail(400, { error: e.issues[0]?.message ?? 'Zkontrolujte zadané hodnoty.' });
		if (e instanceof MailcowError) return fail(502, { error: e.message });
		throw e;
	}
}

export const actions: Actions = {
	dns: async (event) => {
		requireAdmin(event);
		try { return { dns: await mailDomainDns(mailDomain.parse((await event.request.formData()).get('domain'))) }; }
		catch (e) {
			if (e instanceof MailcowError) return fail(502, { error: e.message });
			if (e instanceof ZodError) return fail(400, { error: 'Neplatná doména nebo odpověď DNS z Mailcow.' });
			throw e;
		}
	},
	domain: (event) => change(event, async (f) => {
		const domain = mailDomain.parse(f.get('domain'));
		await createMailDomain({ domain, description: String(f.get('description') ?? ''), quota: z.coerce.number().int().min(512).max(8192).parse(f.get('quota')) });
		return { action: 'mail_domain_create', subject: domain, message: `Poštovní doména ${domain} je založená. MX přepněte až po přípravě schránek a DNS.` };
	}),
	mailbox: (event) => change(event, async (f) => {
		const domain = mailDomain.parse(f.get('domain'));
		const part = localPart.parse(f.get('localPart'));
		await createMailMailbox({ domain, localPart: part, name: String(f.get('name') ?? ''), password: mailboxPassword.parse(f.get('password')), quota: mailboxQuota.parse(f.get('quota')) });
		return { action: 'mail_mailbox_create', subject: `${part}@${domain}`, message: `Schránka ${part}@${domain} je založená.` };
	}),
	state: (event) => change(event, async (f) => {
		const address = mailboxAddress.parse(f.get('address'));
		const active = z.enum(['true', 'false']).parse(f.get('active')) === 'true';
		await updateMailMailbox(address, { active });
		return { action: active ? 'mail_mailbox_enable' : 'mail_mailbox_disable', subject: address, message: `Schránka ${address} je ${active ? 'zapnutá' : 'pozastavená'}.` };
	}),
	password: (event) => change(event, async (f) => {
		const address = mailboxAddress.parse(f.get('address'));
		await updateMailMailbox(address, { password: mailboxPassword.parse(f.get('password')) });
		return { action: 'mail_mailbox_password', subject: address, message: `Heslo schránky ${address} je změněné.` };
	}),
	quota: (event) => change(event, async (f) => {
		const address = mailboxAddress.parse(f.get('address'));
		await updateMailMailbox(address, { quota: mailboxQuota.parse(f.get('quota')) });
		return { action: 'mail_mailbox_quota', subject: address, message: `Kvóta schránky ${address} je změněná.` };
	}),
	alias: (event) => change(event, async (f) => {
		const address = mailboxAddress.parse(f.get('address'));
		await createMailAlias(address, mailboxAddress.parse(f.get('destination')));
		return { action: 'mail_alias_create', subject: address, message: `Přesměrování ${address} je založené.` };
	})
};
