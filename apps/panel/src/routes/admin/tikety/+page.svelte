<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import CategoryChip from '#lib/components/CategoryChip.svelte';
	import DataTable from '#lib/components/DataTable.svelte';
	import PageHeader from '#lib/components/PageHeader.svelte';
	import type { Column } from '#lib/components/table.ts';
	import { ago, TICKET_STATUS_LABEL } from '#lib/format.ts';
	import { categoryLabel, REQUEST_LIST } from '#lib/requests.ts';
	import TicketStatus from './TicketStatus.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	type Row = (typeof data.tickets)[number];
	const filter = $derived(page.url.searchParams.get('stav') ?? 'open');
	const typ = $derived(page.url.searchParams.get('typ') ?? '');
	const byStatus = $derived(filter === 'all' ? data.tickets : data.tickets.filter((t) => t.status === filter));
	const rows = $derived(typ ? byStatus.filter((t) => t.category === typ) : byStatus);
	const query = (stav: string, kategorie: string) => `?${new URLSearchParams({ stav, ...(kategorie ? { typ: kategorie } : {}) })}`;
	const tabs = $derived([
		...(['open', 'waiting', 'closed'] as const).map((s) => ({ key: s, label: s === 'waiting' ? 'Čeká na zákazníka' : TICKET_STATUS_LABEL[s], n: data.tickets.filter((t) => t.status === s).length })),
		{ key: 'all', label: 'Vše', n: data.tickets.length }
	]);
	const columns: Column<Row>[] = [
		{ label: 'Č.', sort: (r) => r.id },
		{ label: 'Předmět', sort: (r) => r.subject },
		{ label: 'Typ', sort: (r) => categoryLabel(r.category) },
		{ label: 'Zákazník', sort: (r) => r.company || r.customer },
		{ label: 'Zpráv', sort: (r) => r.messages, align: 'right' },
		{ label: 'Aktivita', sort: (r) => r.updatedAt.getTime() },
		{ label: 'Stav', sort: (r) => r.status }
	];
</script>

<PageHeader title="Podpora">
	{#snippet meta()}Odpovídáme v pracovní době do pár hodin, havárie u správy serverů hned.{/snippet}
</PageHeader>

<div class="mb-3 flex flex-wrap items-end justify-between gap-x-4 gap-y-2 border-b border-line">
<nav class="-mb-px flex min-w-0 gap-1 overflow-x-auto" aria-label="Filtr stavu">
	{#each tabs as t (t.key)}
		<a href={query(t.key, typ)} data-sveltekit-replacestate aria-current={filter === t.key ? 'page' : undefined}
			class="-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-semibold whitespace-nowrap {filter === t.key ? 'border-accent text-ink' : 'border-transparent text-muted hover:text-ink'}">
			{t.label}<span class="mono text-xs text-muted">{t.n}</span>
		</a>
	{/each}
</nav>
<label class="mb-1.5 flex items-center gap-2 text-xs text-muted">
	Typ
	<select class="input h-7 w-auto py-0 text-xs" value={typ} onchange={(e) => goto(query(filter, e.currentTarget.value), { replace: true, reset: false })}>
		<option value="">Všechny</option>
		{#each REQUEST_LIST as r (r.key)}<option value={r.key}>{r.label}</option>{/each}
	</select>
</label>
</div>

<DataTable {rows} {columns} search={(r) => `${r.id} ${r.subject} ${r.customer} ${r.company} ${categoryLabel(r.category)}`} empty="Žádné tikety v tomto stavu." initialSort={{ column: 5, dir: 'desc' }}>
	{#snippet row(t)}
		<tr class="cursor-pointer" onclick={() => goto(`/admin/tikety/${t.id}`)}>
			<td class="mono text-xs text-muted">#{t.id}</td>
			<td class="font-semibold"><a class="hover:underline" href="/admin/tikety/{t.id}">{t.subject}</a></td>
			<td><CategoryChip category={t.category} /></td>
			<td class="text-xs">{t.company || t.customer}</td>
			<td class="mono text-right text-xs">{t.messages}</td>
			<td class="text-xs text-muted">{ago(t.updatedAt)}</td>
			<td><TicketStatus status={t.status} /></td>
		</tr>
	{/snippet}
</DataTable>
