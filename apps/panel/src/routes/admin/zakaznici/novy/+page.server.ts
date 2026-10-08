import { fail, redirect } from '@sveltejs/kit';
import { audit } from '#lib/server/audit.ts';
import { db } from '#lib/server/db/index.ts';
import { customers } from '#lib/server/db/schema.ts';
import { customerSchema, parseForm } from '#lib/server/forms.ts';
import { requireAdmin } from '#lib/server/guards.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = (event) => {
	requireAdmin(event);
};

export const actions: Actions = {
	default: async (event) => {
		requireAdmin(event);
		const form = await event.request.formData();
		const { data, errors } = parseForm(customerSchema, form);
		if (!data) return fail(400, { errors, values: Object.fromEntries(form) as Record<string, string> });
		const [{ id }] = await db.insert(customers).values({ ...data, note: data.note || null }).$returningId();
		await audit(event, 'customer_create', `zákazník ${id}`, data.company || data.name);
		redirect(303, `/admin/zakaznici/${id}`);
	}
};
