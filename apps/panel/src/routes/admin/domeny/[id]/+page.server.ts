import { error, fail, redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { audit } from '#lib/server/audit.ts';
import { db } from '#lib/server/db/index.ts';
import { customers, domains } from '#lib/server/db/schema.ts';
import { checkbox, optionalDate, parseForm } from '#lib/server/forms.ts';
import { requireAdmin } from '#lib/server/guards.ts';
import type { Actions, PageServerLoad } from './$types';

async function getDomain(id: number) {
	const [d] = await db.select().from(domains).where(eq(domains.id, id));
	if (!d) error(404, 'Doména neexistuje.');
	return d;
}

export const load: PageServerLoad = async (event) => {
	requireAdmin(event);
	const domain = await getDomain(Number(event.params.id));
	const [customer] = await db.select().from(customers).where(eq(customers.id, domain.customerId));
	return { domain, customer };
};

const schema = z.object({
	registrar: z.string().trim().max(60).default('Subreg'),
	managedByUs: checkbox,
	expiresAt: optionalDate,
	note: z.string().trim().max(4000).transform((v) => v || null)
});

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
		// Recorded after the renewal was paid at the registrar; the panel never talks to the registry.
		const base = domain.expiresAt ? new Date(domain.expiresAt) : new Date();
		base.setFullYear(base.getFullYear() + 1);
		const next = base.toISOString().slice(0, 10);
		await db.update(domains).set({ expiresAt: next }).where(eq(domains.id, domain.id));
		await audit(event, 'domain_renew', domain.name, `do ${next}`);
		return { message: `Zapsáno prodloužení do ${next.split('-').reverse().join('. ')}.` };
	},
	remove: async (event) => {
		requireAdmin(event);
		const domain = await getDomain(Number(event.params.id));
		await db.delete(domains).where(eq(domains.id, domain.id));
		await audit(event, 'domain_delete', domain.name);
		redirect(303, '/admin/domeny');
	}
};
