import { z } from 'zod';
import type { OrderStatus } from './constants';

const DOMAIN = /^(?=.{3,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z][a-z0-9-]{1,62}$/;
const trimmed = (max: number) => z.string().trim().max(max, `Maximálně ${max} znaků.`);

/** The body servero.cz/objednat.html sends to POST /api/orders. */
export const publicOrderSchema = z
	.object({
		plan: z.string().trim().min(1, 'Vyberte tarif.').max(40),
		period: z.enum(['month', 'year']),
		domain: trimmed(253)
			.transform((v) => v.toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, ''))
			.default(''),
		domainMode: z.enum(['own', 'register', 'none']).default('none'),
		name: trimmed(160).min(2, 'Vyplňte jméno.'),
		email: z.string().trim().toLowerCase().pipe(z.email('Zadejte platný e-mail.')),
		phone: trimmed(32)
			.regex(/^[+\d\s()-]*$/, 'Telefon obsahuje neplatné znaky.')
			.default(''),
		company: trimmed(160).default(''),
		ico: z
			.string()
			.trim()
			.regex(/^(\d{8})?$/, 'IČO má 8 číslic.')
			.default(''),
		dic: trimmed(20).default(''),
		address: trimmed(255).default(''),
		note: trimmed(2000).default(''),
		// Honeypot: humans never see this field.
		website: z.string().max(500).default(''),
		consent: z.literal(true, 'Bez souhlasu s podmínkami objednávku nepřijmeme.'),
		turnstileToken: z.string().max(4096).optional()
	})
	.superRefine((v, ctx) => {
		if (v.domainMode !== 'none' && !DOMAIN.test(v.domain))
			ctx.addIssue({ code: 'custom', path: ['domain'], message: 'Zadejte doménu ve tvaru firma.cz.' });
	});

export type PublicOrder = z.infer<typeof publicOrderSchema>;

/** First message per field, in the `{ errors: { field: message } }` shape the landing renders. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
	const out: Record<string, string> = {};
	for (const issue of error.issues) {
		const key = String(issue.path[0] ?? 'form');
		out[key] ??= issue.message;
	}
	return out;
}

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
	new: 'Nová',
	contacted: 'Kontaktováno',
	provisioning: 'Zřizujeme',
	done: 'Hotovo',
	cancelled: 'Zrušeno'
};

// The manual fulfilment flow; anything else is a mistake worth refusing.
const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
	new: ['contacted', 'provisioning', 'cancelled'],
	contacted: ['provisioning', 'cancelled'],
	provisioning: ['done', 'contacted', 'cancelled'],
	done: [],
	cancelled: ['new']
};

export const nextStatuses = (from: OrderStatus) => TRANSITIONS[from];
export const canTransition = (from: OrderStatus, to: OrderStatus) => TRANSITIONS[from].includes(to);

/** Body of the "Objednat" form in the client zone. Contact details come from the customer record, not the form. */
export const panelOrderSchema = z
	.object({
		plan: z.string().trim().min(1, 'Vyberte tarif.').max(40),
		period: z.enum(['month', 'year'], 'Vyberte období platby.'),
		domainMode: z.enum(['own', 'register', 'none'], 'Vyberte, jak to bude s doménou.'),
		domain: trimmed(253)
			.transform((v) => v.toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, ''))
			.default(''),
		note: trimmed(2000).default('')
	})
	.superRefine((v, ctx) => {
		if (v.domainMode !== 'none' && !DOMAIN.test(v.domain))
			ctx.addIssue({ code: 'custom', path: ['domain'], message: 'Zadejte doménu ve tvaru firma.cz.' });
	});

/** Catalog categories (plans.category) in the order the client zone shows them. */
export const PLAN_CATEGORY_LABEL: Record<string, string> = {
	hosting: 'Webhosting',
	apps: 'Aplikace a WordPress',
	vps: 'Virtuální servery',
	management: 'Správa serverů'
};
