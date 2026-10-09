<script lang="ts">
	import { enhance } from '$app/forms';
	import { keepResult } from '#lib/forms.ts';
	import Button from '#lib/components/Button.svelte';
	import Field from '#lib/components/Field.svelte';
	import FormMessage from '#lib/components/FormMessage.svelte';
	import PageHeader from '#lib/components/PageHeader.svelte';
	import Panel from '#lib/components/Panel.svelte';
	import Pill from '#lib/components/Pill.svelte';
	import { date, daysUntil } from '#lib/format.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const d = $derived(data.domain);
	const days = $derived(daysUntil(d.expiresAt));
	const errors = $derived<Record<string, string>>(form && 'errors' in form ? (form.errors ?? {}) : {});
	let confirmDelete = $state(false);
</script>

<PageHeader title={d.name} crumbs={[{ href: '/admin/domeny', label: 'Domény' }, { href: `/admin/zakaznici/${data.customer.id}`, label: data.customer.company || data.customer.name }]}>
	{#snippet meta()}
		{#if days == null}<Pill>Bez data expirace</Pill>{:else if days < 0}<Pill tone="bad">Propadlá {-days} dní</Pill>{:else if days <= 30}<Pill tone="warn">Vyprší za {days} dní</Pill>{:else}<Pill tone="ok">Platí do {date(d.expiresAt)}</Pill>{/if}
	{/snippet}
	{#snippet actions()}
		<Button href="https://www.nic.cz/whois/domain/{d.name}/" target="_blank" rel="noreferrer">WHOIS</Button>
	{/snippet}
</PageHeader>

<FormMessage {form} />

<div class="grid max-w-5xl gap-5 lg:grid-cols-[1.4fr_1fr]">
	<form method="POST" action="?/update" use:enhance={keepResult()}>
		<Panel title="Evidence">
			<div class="grid gap-4 sm:grid-cols-2">
				<Field label="Registrátor" id="d-reg"><input class="input" id="d-reg" name="registrar" value={d.registrar} /></Field>
				<Field label="Expirace" id="d-exp" error={errors.expiresAt}><input class="input" id="d-exp" name="expiresAt" type="date" value={d.expiresAt ?? ''} /></Field>
				<label class="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" name="managedByUs" checked={d.managedByUs} class="size-4" /> Prodlužujeme my (fakturujeme 249 Kč/rok)</label>
				<Field label="Poznámka" id="d-note" class="sm:col-span-2"><textarea class="input" id="d-note" name="note">{d.note ?? ''}</textarea></Field>
			</div>
			<div class="mt-5 flex justify-end"><Button type="submit" variant="primary">Uložit</Button></div>
		</Panel>
	</form>
	<div class="flex flex-col gap-5">
		<Panel title="Prodloužení">
			<p class="mb-3 text-sm text-muted">Doménu prodlužte ručně u registrátora, pak zapište nové datum. Panel s registrem nekomunikuje.</p>
			<form method="POST" action="?/renew" use:enhance={keepResult()}><Button type="submit">Zapsat prodloužení o rok</Button></form>
		</Panel>
		<Panel title="Odebrat z evidence">
			{#if confirmDelete}
				<form method="POST" action="?/remove" class="flex flex-col gap-3">
					<p class="text-sm">Doména zmizí z panelu. U registrátora se nic nezmění.</p>
					<div class="flex gap-2"><Button type="submit" variant="danger">Odebrat</Button><Button variant="ghost" onclick={() => (confirmDelete = false)}>Zpět</Button></div>
				</form>
			{:else}
				<Button variant="danger" onclick={() => (confirmDelete = true)}>Odebrat doménu</Button>
			{/if}
		</Panel>
	</div>
</div>
