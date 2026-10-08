<script lang="ts">
	import { enhance } from '$app/forms';
	import Button from '#lib/components/Button.svelte';
	import Field from '#lib/components/Field.svelte';
	import FormMessage from '#lib/components/FormMessage.svelte';
	import PageHeader from '#lib/components/PageHeader.svelte';
	import Panel from '#lib/components/Panel.svelte';
	import Contact from '../../Contact.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	let busy = $state(false);
</script>

<PageHeader title="Nový požadavek" crumbs={[{ href: '/app/podpora', label: 'Podpora' }]}>
	{#snippet meta()}Popište, co se děje. Ozveme se v pracovní době do pár hodin.{/snippet}
</PageHeader>

<div class="grid gap-5 xl:grid-cols-[1fr_300px]">
	<Panel class="min-w-0">
		<FormMessage {form} />
		<form
			method="POST"
			class="flex flex-col gap-4"
			use:enhance={() => {
				busy = true;
				return async ({ update }) => {
					await update({ reset: false });
					busy = false;
				};
			}}
		>
			<Field label="Předmět" id="subject">
				<input
					class="input"
					id="subject"
					name="subject"
					required
					maxlength={data.limits.subject}
					value={form?.subject ?? data.subject}
					placeholder="Například: nechodí e-maily z formuláře"
				/>
			</Field>
			{#if data.services.length}
				<Field label="Služba" id="service" hint="Nepovinné. Pomůže nám rychleji najít, kde hledat.">
					<select class="input" id="service" name="service">
						<option value="">Netýká se konkrétní služby</option>
						{#each data.services as s (s.id)}
							<option value={String(s.id)} selected={form ? form.service === String(s.id) : data.preselected === s.id}>{s.label}</option>
						{/each}
					</select>
				</Field>
			{/if}
			<Field label="Zpráva" id="body" hint="Co se stalo, odkdy, na jaké adrese. Klidně vložte text chyby.">
				<textarea class="input min-h-48" id="body" name="body" required maxlength={data.limits.body} value={form?.body ?? ''}></textarea>
			</Field>
			<div class="flex flex-wrap justify-end gap-2">
				<Button href="/app/podpora" variant="ghost">Zrušit</Button>
				<Button type="submit" variant="primary" disabled={busy}>{busy ? 'Odesílám' : 'Odeslat požadavek'}</Button>
			</div>
		</form>
	</Panel>

	<div class="min-w-0">
		<Contact cta={false} />
		<p class="mt-3 px-1 text-xs text-muted">Když web úplně nejde, raději rovnou zavolejte.</p>
	</div>
</div>
