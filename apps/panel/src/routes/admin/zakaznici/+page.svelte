<script lang="ts">
	import { goto } from '$app/navigation';
	import { Plus } from '@lucide/svelte';
	import Button from '#lib/components/Button.svelte';
	import DataTable from '#lib/components/DataTable.svelte';
	import PageHeader from '#lib/components/PageHeader.svelte';
	import type { Column } from '#lib/components/table.ts';
	import { czk, date } from '#lib/format.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	type Row = (typeof data.customers)[number];
	const columns: Column<Row>[] = [
		{ label: 'Zákazník', sort: (r) => r.company || r.name },
		{ label: 'IČO', sort: (r) => r.ico },
		{ label: 'E-mail', sort: (r) => r.email },
		{ label: 'Aktivní služby', sort: (r) => r.active, align: 'right' },
		{ label: 'MRR', sort: (r) => r.mrr, align: 'right' },
		{ label: 'Od', sort: (r) => r.createdAt.getTime() }
	];
</script>

<PageHeader title="Zákazníci">
	{#snippet actions()}<Button href="/admin/zakaznici/novy" variant="primary"><Plus size={16} /> Nový zákazník</Button>{/snippet}
</PageHeader>

<DataTable rows={data.customers} {columns} search={(r) => `${r.name} ${r.company} ${r.ico} ${r.email}`} empty="Zatím žádní zákazníci." initialSort={{ column: 0, dir: 'asc' }}>
	{#snippet row(c)}
		<tr class="cursor-pointer" onclick={() => goto(`/admin/zakaznici/${c.id}`)}>
			<td>
				<a href="/admin/zakaznici/{c.id}" class="font-semibold hover:underline">{c.company || c.name}</a>
				{#if c.company}<div class="text-xs text-muted">{c.name}</div>{/if}
			</td>
			<td class="mono text-xs">{c.ico || '·'}</td>
			<td class="text-xs">{c.email}</td>
			<td class="mono text-right">{c.active}</td>
			<td class="mono text-right text-xs">{czk(c.mrr)}</td>
			<td class="text-xs text-muted">{date(c.createdAt)}</td>
		</tr>
	{/snippet}
</DataTable>
