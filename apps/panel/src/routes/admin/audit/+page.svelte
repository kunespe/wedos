<script lang="ts">
	import DataTable from '#lib/components/DataTable.svelte';
	import PageHeader from '#lib/components/PageHeader.svelte';
	import type { Column } from '#lib/components/table.ts';
	import { ago, dateTime } from '#lib/format.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	type Row = (typeof data.rows)[number];

	const columns: Column<Row>[] = [
		{ label: 'Čas', sort: (r) => r.createdAt.getTime() },
		{ label: 'Kdo', sort: (r) => r.actor },
		{ label: 'Akce', sort: (r) => r.action },
		{ label: 'Předmět', sort: (r) => r.subject },
		{ label: 'Detail' },
		{ label: 'IP', sort: (r) => r.ip }
	];
</script>

<PageHeader title="Historie">
	{#snippet meta()}Kdo co v panelu udělal. Posledních 1000 záznamů, nejnovější nahoře.{/snippet}
</PageHeader>

<DataTable
	rows={data.rows}
	{columns}
	search={(r) => `${r.actor ?? 'systém'} ${r.actorEmail ?? ''} ${r.action} ${r.subject} ${r.details ?? ''} ${r.ip}`}
	empty="Zatím žádné záznamy."
	initialSort={{ column: 0, dir: 'desc' }}
	pageSize={100}
>
	{#snippet row(r)}
		<tr>
			<td class="text-xs whitespace-nowrap" title={ago(r.createdAt)}>{dateTime(r.createdAt)}</td>
			<td class="text-sm whitespace-nowrap" title={r.actorEmail ?? undefined}>{r.actor ?? 'Systém'}</td>
			<td class="mono text-xs whitespace-nowrap">{r.action}</td>
			<td class="mono max-w-56 truncate text-xs" title={r.subject}>{r.subject || '·'}</td>
			<td class="max-w-96 truncate text-xs text-muted" title={r.details ?? undefined}>{r.details ?? ''}</td>
			<td class="mono text-xs whitespace-nowrap text-muted">{r.ip}</td>
		</tr>
	{/snippet}
</DataTable>
