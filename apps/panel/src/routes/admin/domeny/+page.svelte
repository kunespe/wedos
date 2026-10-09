<script lang="ts">
	import { goto } from '$app/navigation';
	import DataTable from '#lib/components/DataTable.svelte';
	import Led from '#lib/components/Led.svelte';
	import PageHeader from '#lib/components/PageHeader.svelte';
	import Pill from '#lib/components/Pill.svelte';
	import type { Column } from '#lib/components/table.ts';
	import { date, daysUntil } from '#lib/format.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
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
		Registrace a prodloužení děláme ručně přes Subreg. {#if soon}<Pill tone="warn">{soon} do 30 dní</Pill>{/if}
	{/snippet}
</PageHeader>

<DataTable rows={data.domains} {columns} search={(r) => `${r.name} ${r.customer} ${r.company}`} empty="Žádné domény v evidenci." initialSort={{ column: 5, dir: 'asc' }}>
	{#snippet row(d)}
		{@const days = daysUntil(d.expiresAt)}
		<tr class="cursor-pointer" onclick={() => goto(`/admin/domeny/${d.id}`)}>
			<td><Led state={days == null ? 'off' : days < 0 ? 'bad' : days <= 30 ? 'warn' : 'ok'} /></td>
			<td class="mono font-medium"><a class="hover:underline" href="/admin/domeny/{d.id}">{d.name}</a></td>
			<td class="text-xs"><a class="hover:underline" href="/admin/zakaznici/{d.customerId}" onclick={(e) => e.stopPropagation()}>{d.company || d.customer}</a></td>
			<td class="text-xs">{d.registrar}</td>
			<td class="text-xs">{d.managedByUs ? 'my' : 'zákazník'}</td>
			<td class="mono text-xs {days != null && days < 0 ? 'text-bad' : days != null && days <= 30 ? 'text-warn' : 'text-muted'}">
				{date(d.expiresAt)}{days != null && days <= 60 ? ` · ${days < 0 ? 'propadlá' : `${days} d`}` : ''}
			</td>
		</tr>
	{/snippet}
</DataTable>
