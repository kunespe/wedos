<script lang="ts">
	import Field from '#lib/components/Field.svelte';
	type Values = { name?: string; company?: string; ico?: string; dic?: string; address?: string; email?: string; phone?: string; note?: string | null };
	let { values = {}, errors = {} }: { values?: Values; errors?: Record<string, string> } = $props();
	const fields = [
		['name', 'Jméno a příjmení', 'text', 'name'],
		['email', 'E-mail', 'email', 'email'],
		['phone', 'Telefon', 'tel', 'tel'],
		['company', 'Firma', 'text', 'organization'],
		['ico', 'IČO', 'text', 'off'],
		['dic', 'DIČ', 'text', 'off'],
		['address', 'Adresa', 'text', 'street-address']
	] as const;
</script>

<div class="grid gap-4 sm:grid-cols-2">
	{#each fields as [key, label, type, auto] (key)}
		<Field {label} id="c-{key}" error={errors[key]} class={key === 'address' ? 'sm:col-span-2' : ''}>
			<input
				class="input"
				id="c-{key}"
				name={key}
				{type}
				autocomplete={auto}
				value={values[key] ?? ''}
				required={key === 'name' || key === 'email'}
				aria-invalid={errors[key] ? 'true' : undefined}
				aria-describedby={errors[key] ? `c-${key}-error` : undefined}
			/>
		</Field>
	{/each}
	<Field label="Interní poznámka" id="c-note" class="sm:col-span-2" hint="Zákazník ji nevidí.">
		<textarea class="input" id="c-note" name="note">{values.note ?? ''}</textarea>
	</Field>
</div>
