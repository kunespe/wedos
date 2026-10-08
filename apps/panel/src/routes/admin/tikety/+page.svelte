<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import DataTable from '#lib/components/DataTable.svelte';
	import PageHeader from '#lib/components/PageHeader.svelte';
	import type { Column } from '#lib/components/table.ts';
	import { ago, TICKET_STATUS_LABEL } from '#lib/format.ts';
	import TicketStatus from './TicketStatus.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	type Row = (typeof data.tickets)[number];
	const filter = $derived(page.url.searchParams.get('stav') ?? 'open');
	const rows = $derived(filter === 'all' ? data.tickets : data.tickets.filter((t) => t.status === filter));
	const tabs = $derived([
		...(['open', 'waiting', 'closed'] as const).map((s) => ({ key: s, label: s === 'waiting' ? 'Čeká na zákazníka' : TICKET_STATUS_LABEL[s], n: data.tickets.filter((t) => t.status === s).length })),
		{ key: 'all', label: 'Vše', n: data.tickets.length }
	]);
	const columns: Column<Row>[] = [
		{ label: 'Č.', sort: (r) => r.id },
		{ label: 'Předmět', sort: (r) => r.subject },
		{ label: 'Zákazník', sort: (r) => r.company || r.customer },
		{ label: 'Zpráv', sort: (r) => r.messages, align: 'right' },
		{ label: 'Aktivita', sort: (r) => r.updatedAt.getTime() },
		{ label: 'Stav', sort: (r) => r.status }
	];
</script>

<PageHeader title="Podpora">
	{#snippet meta()}Odpovídáme v pracovní době do pár hodin, havárie u správy serverů hned.{/snippet}
</PageHeader>

<nav class="mb-3 flex gap-1 overflow-x-auto border-b border-line" aria-label="Filtr stavu">
	{#each tabs as t (t.key)}
		<a href="?stav={t.key}" data-sveltekit-replacestate aria-current={filter === t.key ? 'page' : undefined}
			class="-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-semibold whitespace-nowrap {filter === t.key ? 'border-accent text-ink' : 'border-transparent text-muted hover:text-ink'}">
			{t.label}<span class="mono text-xs text-muted">{t.n}</span>
		</a>
	{/each}
</nav>

<DataTable {rows} {columns} search={(r) => `${r.id} ${r.subject} ${r.customer} ${r.company}`} empty="Žádné tikety v tomto stavu." initialSort={{ column: 4, dir: 'desc' }}>
	{#snippet row(t)}
		<tr class="cursor-pointer" onclick={() => goto(`/admin/tikety/${t.id}`)}>
			<td class="mono text-xs text-muted">#{t.id}</td>
			<td class="font-semibold"><a class="hover:underline" href="/admin/tikety/{t.id}">{t.subject}</a></td>
			<td class="text-xs">{t.company || t.customer}</td>
			<td class="mono text-right text-xs">{t.messages}</td>
			<td class="text-xs text-muted">{ago(t.updatedAt)}</td>
			<td><TicketStatus status={t.status} /></td>
		</tr>
	{/snippet}
</DataTable>
