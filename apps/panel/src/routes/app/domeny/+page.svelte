<script lang="ts">
	import DataTable from '#lib/components/DataTable.svelte';
	import Led from '#lib/components/Led.svelte';
	import PageHeader from '#lib/components/PageHeader.svelte';
	import Pill from '#lib/components/Pill.svelte';
	import type { Column } from '#lib/components/table.ts';
	import { date } from '#lib/format.ts';
	import { expiryHint, expiryTone, TEXT_TONE } from '../tones.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	type Row = (typeof data.domains)[number];

	// Price of a .cz domain per year excl. VAT; keep in sync with the storefront price list.
	const CZ_PRICE = '249 Kč';

	const columns: Column<Row>[] = [
		{ label: 'Doména', sort: (r) => r.name },
		{ label: 'Kdo ji spravuje', sort: (r) => (r.managedByUs ? 0 : 1) },
		{ label: 'Platí do', sort: (r) => r.expiresAt }
	];
</script>

<PageHeader title="Domény">
	{#snippet meta()}Domény, na kterých běží vaše weby.{/snippet}
</PageHeader>

<div class="grid gap-5 xl:grid-cols-[1.6fr_1fr]">
	<div class="min-w-0">
		<DataTable rows={data.domains} {columns} empty="Zatím u nás nemáte žádnou doménu." initialSort={{ column: 2, dir: 'asc' }}>
			{#snippet row(d)}
				{@const tone = expiryTone(d.expiresAt, 60)}
				<tr>
					<td class="mono font-medium">
						<span class="flex items-center gap-2"><Led state={tone} />{d.name}</span>
					</td>
					<td>
						{#if d.managedByUs}
							<Pill tone="ok">spravujeme my</Pill>
						{:else}
							<Pill tone="off">u jiného registrátora</Pill>
						{/if}
					</td>
					<td class="text-xs whitespace-nowrap">
						<span class="mono">{date(d.expiresAt)}</span>
						{#if d.expiresAt}<div class={TEXT_TONE[tone]}>{expiryHint(d.expiresAt)}</div>{/if}
					</td>
				</tr>
			{/snippet}
		</DataTable>
	</div>

	<aside class="flex min-w-0 flex-col gap-3 rounded-[6px] border border-line bg-surface p-4 text-sm">
		<h2 class="font-bold">Jak to s doménami funguje</h2>
		<p>
			<strong>Spravujeme my:</strong> doménu platíme u registru za vás a prodlužujeme ji sami, nic nemusíte hlídat. Doména
			<span class="mono">.cz</span> stojí {CZ_PRICE} ročně bez DPH a je na faktuře spolu s hostingem.
		</p>
		<p>
			<strong>U jiného registrátora:</strong> doménu si platíte sami. My jen nastavujeme DNS, aby web běžel u nás. Prodloužení
			hlídejte u svého registrátora, jinak web přestane fungovat.
		</p>
		<p class="text-muted">
			Chcete doménu převést k nám, přidat novou nebo změnit DNS?
			<a class="font-semibold text-accent hover:underline" href="/app/podpora/novy?predmet={encodeURIComponent('Domény')}">Napište nám</a>.
		</p>
	</aside>
</div>
