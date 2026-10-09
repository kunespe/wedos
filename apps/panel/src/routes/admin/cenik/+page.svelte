<script lang="ts">
	import DataTable from '#lib/components/DataTable.svelte';
	import PageHeader from '#lib/components/PageHeader.svelte';
	import Pill from '#lib/components/Pill.svelte';
	import ServiceKind from '#lib/components/ServiceKind.svelte';
	import type { Column } from '#lib/components/table.ts';
	import { czk } from '#lib/format.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	type Plan = (typeof data.plans)[number];

	const columns: Column<Plan>[] = [
		{ label: 'Kód', sort: (r) => r.code },
		{ label: 'Kategorie', sort: (r) => r.category },
		{ label: 'Druh', sort: (r) => r.kind },
		{ label: 'Název', sort: (r) => r.name },
		{ label: 'Cena / měs.', sort: (r) => r.monthly, align: 'right' },
		{ label: 'Stav', sort: (r) => (r.active ? 1 : 0) },
		{ label: 'Obsahuje' }
	];
</script>

<PageHeader title="Ceník">
	{#snippet meta()}Tarify, které nabízí web a objednávkový formulář. Ceny bez DPH.{/snippet}
</PageHeader>

<div class="mb-4 rounded-[6px] border border-line bg-surface-2 px-4 py-3 text-sm">
	Jen pro čtení. Zdrojem pravdy je <span class="mono">catalog/plans.json</span> v repozitáři; změny se do databáze propíšou při nasazení přes
	<span class="mono">pnpm db:seed</span>. Cena v objednávce i službě se ukládá v okamžiku objednání, takže změna ceníku nepřepisuje historii.
</div>

<DataTable rows={data.plans} {columns} search={(r) => `${r.code} ${r.name} ${r.category} ${r.kind} ${r.features.join(' ')}`} empty="Ceník je prázdný. Spusťte pnpm db:seed.">
	{#snippet row(p)}
		<tr>
			<td class="mono text-xs whitespace-nowrap">{p.code}</td>
			<td class="text-sm whitespace-nowrap">{p.category}</td>
			<td class="text-sm whitespace-nowrap"><ServiceKind kind={p.kind} /></td>
			<td class="font-semibold whitespace-nowrap">{p.name}</td>
			<td class="mono text-right text-xs whitespace-nowrap">{p.priceFrom && p.monthly != null ? 'od ' : ''}{czk(p.monthly)}</td>
			<td>{#if p.active}<Pill tone="ok">Nabízí se</Pill>{:else}<Pill tone="off">Skrytý</Pill>{/if}</td>
			<td class="py-2 text-xs text-muted">
				<span class="block max-w-[28rem] min-w-56">{p.features.join(' · ')}</span>
			</td>
		</tr>
	{/snippet}
</DataTable>
