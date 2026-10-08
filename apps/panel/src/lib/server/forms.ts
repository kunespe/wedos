import { z } from 'zod';
import { fieldErrors } from '../orders';

/** Parses FormData with a zod schema; returns `{ data }` or `{ errors }` keyed by field. */
export function parseForm<S extends z.ZodType>(schema: S, form: FormData) {
	const raw = Object.fromEntries([...form.keys()].map((k) => [k, form.getAll(k).length > 1 ? form.getAll(k) : form.get(k)]));
	const parsed = schema.safeParse(raw);
	if (parsed.success) return { data: parsed.data as z.infer<S>, errors: null };
	return { data: null, errors: fieldErrors(parsed.error) };
}

const text = (max: number) => z.string().trim().max(max, `Maximálně ${max} znaků.`);

export const customerSchema = z.object({
	name: text(160).min(2, 'Vyplňte jméno.'),
	company: text(160).default(''),
	ico: z.string().trim().regex(/^(\d{8})?$/, 'IČO má 8 číslic.').default(''),
	dic: text(20).default(''),
	address: text(255).default(''),
	email: z.string().trim().toLowerCase().pipe(z.email('Zadejte platný e-mail.')),
	phone: text(32).default(''),
	note: text(4000).default('')
});

export const optionalDate = z
	.string()
	.trim()
	.regex(/^(\d{4}-\d{2}-\d{2})?$/, 'Datum ve tvaru RRRR-MM-DD.')
	.transform((v) => v || null);

export const checkbox = z.preprocess((v) => v === 'on' || v === 'true', z.boolean());
export const optionalInt = z.preprocess(
	(v) => (v === '' || v == null ? null : Number(v)),
	z.number().int('Celé číslo.').nonnegative().nullable()
);
