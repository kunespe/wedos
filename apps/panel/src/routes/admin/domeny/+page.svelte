<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { keepResult } from '#lib/forms.ts';
	import BrandIcon from '#lib/components/BrandIcon.svelte';
	import Button from '#lib/components/Button.svelte';
	import FormMessage from '#lib/components/FormMessage.svelte';
	import Panel from '#lib/components/Panel.svelte';
	import DataTable from '#lib/components/DataTable.svelte';
	import Led from '#lib/components/Led.svelte';
	import PageHeader from '#lib/components/PageHeader.svelte';
	import Pill from '#lib/components/Pill.svelte';
	import type { Column } from '#lib/components/table.ts';
	import { companyBrand } from '#lib/brands.ts';
	import { date, daysUntil } from '#lib/format.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const w = $derived(data.wedos);
	const cmp = $derived(form && 'compare' in form ? form.compare : null);
	const pinged = $derived(form && 'ping' in form ? form.ping : null);
	type Row = (typeof data.domains)[number];
	const columns: Column<Row>[] = [
		{ label: '', class: 'w-6' },
		{ label: 'Doména', sort: (r) => r.name },
		{ label: 'Zákazník', sort: (r) => r.company || r.customer },
		{ label: 'Registrátor', sort: (r) => r.registrar },
		{ label: 'Prodlužuje', sort: (r) => (r.managedByUs ? 0 : 1) },
		{ label: 'Expirace', sort: (r) => r.expiresAt }
	];
	const soon = $derived(data.domains.filter((d) => d.managedByUs && (daysUntil(d.expiresAt) ?? 999) <= 30).length);
</script>

<PageHeader title="Domény">
	{#snippet meta()}
		<span><BrandIcon name="wedos" class="mr-1" />Registrace a prodloužení děláme ručně přes WEDOS (tlačítka v detailu domény).</span>
		{#if soon}<Pill tone="warn">{soon} do 30 dní</Pill>{/if}
		{#if !w.configured}<Pill>WEDOS nenastaven</Pill>{:else if w.live}<Pill tone="bad">WEDOS ostrý režim</Pill>{:else}<Pill tone="warn">WEDOS testovací režim</Pill>{/if}
	{/snippet}
	{#snippet actions()}
		{#if w.configured}
			<form method="POST" action="?/ping" use:enhance={keepResult()}><Button type="submit" size="sm" variant="ghost">WAPI ping</Button></form>
			<form method="POST" action="?/compare" use:enhance={keepResult()}><Button type="submit" size="sm">Porovnat s WEDOS</Button></form>
		{/if}
	{/snippet}
</PageHeader>

<FormMessage {form} />

{#if !w.configured}
	<p class="mb-4 rounded-[6px] border border-line bg-surface-2 px-3 py-2 text-sm text-muted">
		Propojení s WEDOS není nastavené (chybí <span class="mono">{w.missing.join(', ')}</span>). Domény se zatím evidují jen ručně, postup nastavení je v README panelu.
	</p>
{/if}

{#if pinged}
	<p class="mb-4 text-sm text-muted">Ping: odpověď za {pinged.ms} ms z IP serveru <span class="mono">{w.serverIp}</span>, tedy povolená v seznamu WAPI.</p>
{/if}

{#if cmp}
	<Panel title="Porovnání s WEDOS" brand="wedos" class="mb-5">
		<p class="mb-3 text-sm text-muted">U WEDOS {cmp.total} domén, z toho {cmp.matched} v panelu. Nic se nezměnilo, jen přehled.</p>
		<div class="grid gap-5 md:grid-cols-2">
			<div class="min-w-0">
				<h3 class="mb-1 text-sm font-bold">U WEDOS, ale ne v panelu ({cmp.onlyWedos.length})</h3>
				{#if cmp.onlyWedos.length}
					<ul class="divide-y divide-line text-sm">
						{#each cmp.onlyWedos as dm (dm.name)}<li class="flex justify-between gap-2 py-1.5"><span class="mono break-all">{dm.name}</span><span class="text-xs text-muted">{dm.status}</span></li>{/each}
					</ul>
					<p class="mt-2 text-xs text-muted">Přidejte je k zákazníkovi v jeho detailu (Přidat doménu).</p>
				{:else}<p class="text-sm text-muted">Žádné.</p>{/if}
			</div>
			<div class="min-w-0">
				<h3 class="mb-1 text-sm font-bold">V panelu jako WEDOS, ale u WEDOS chybí ({cmp.missingAtWedos.length})</h3>
				{#if cmp.missingAtWedos.length}
					<ul class="divide-y divide-line text-sm">
						{#each cmp.missingAtWedos as dm (dm.id)}<li class="py-1.5"><a class="mono break-all hover:underline" href="/admin/domeny/{dm.id}">{dm.name}</a></li>{/each}
					</ul>
					<p class="mt-2 text-xs text-muted">Buď ještě nejsou zaregistrované, nebo mají špatně vyplněného registrátora.</p>
				{:else}<p class="text-sm text-muted">Žádné.</p>{/if}
			</div>
		</div>
	</Panel>
{/if}

<DataTable rows={data.domains} {columns} search={(r) => `${r.name} ${r.customer} ${r.company}`} empty="Žádné domény v evidenci." initialSort={{ column: 5, dir: 'asc' }}>
	{#snippet row(d)}
		{@const days = daysUntil(d.expiresAt)}
		{@const registrar = companyBrand(d.registrar)}
		<tr class="cursor-pointer" onclick={() => goto(`/admin/domeny/${d.id}`)}>
			<td><Led state={days == null ? 'off' : days < 0 ? 'bad' : days <= 30 ? 'warn' : 'ok'} /></td>
			<td class="mono font-medium"><a class="hover:underline" href="/admin/domeny/{d.id}">{d.name}</a></td>
			<td class="text-xs"><a class="hover:underline" href="/admin/zakaznici/{d.customerId}" onclick={(e) => e.stopPropagation()}>{d.company || d.customer}</a></td>
			<td class="text-xs">
				<span class="inline-flex items-center gap-1.5">{#if registrar}<BrandIcon name={registrar} size={14} />{/if}{d.registrar}</span>
			</td>
			<td class="text-xs">{d.managedByUs ? 'my' : 'zákazník'}</td>
			<td class="mono text-xs {days != null && days < 0 ? 'text-bad' : days != null && days <= 30 ? 'text-warn' : 'text-muted'}">
				{date(d.expiresAt)}{days != null && days <= 60 ? ` · ${days < 0 ? 'propadlá' : `${days} d`}` : ''}
			</td>
		</tr>
	{/snippet}
</DataTable>
