<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import DataTable from '#lib/components/DataTable.svelte';
	import PageHeader from '#lib/components/PageHeader.svelte';
	import type { Column } from '#lib/components/table.ts';
	import { ORDER_STATUSES, type OrderStatus as Status } from '#lib/constants.ts';
	import { ago, czk, dateTime } from '#lib/format.ts';
	import { ORDER_STATUS_LABEL } from '#lib/orders.ts';
	import OrderStatus from './OrderStatus.svelte';
	import SourceChip from './SourceChip.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	type Row = (typeof data.orders)[number];

	// "open" is the working view: everything that still needs a human.
	const filter = $derived(page.url.searchParams.get('stav') ?? 'open');
	const rows = $derived(
		filter === 'all'
			? data.orders
			: filter === 'open'
				? data.orders.filter((o) => ['new', 'contacted', 'provisioning'].includes(o.status))
				: data.orders.filter((o) => o.status === filter)
	);
	const count = (s: Status) => data.orders.filter((o) => o.status === s).length;
	const tabs = $derived([
		{ key: 'open', label: 'K vyřízení', n: data.orders.filter((o) => ['new', 'contacted', 'provisioning'].includes(o.status)).length },
		...ORDER_STATUSES.map((s) => ({ key: s, label: ORDER_STATUS_LABEL[s], n: count(s) })),
		{ key: 'all', label: 'Vše', n: data.orders.length }
	]);

	const columns: Column<Row>[] = [
		{ label: 'Č.', sort: (r) => r.id },
		{ label: 'Zákazník', sort: (r) => r.company || r.name },
		{ label: 'Tarif', sort: (r) => r.plan },
		{ label: 'Doména', sort: (r) => r.domain },
		{ label: 'Cena / měs.', sort: (r) => r.priceMonthly, align: 'right' },
		{ label: 'Řeší', sort: (r) => r.assignee },
		{ label: 'Přišla', sort: (r) => r.createdAt.getTime() },
		{ label: 'Stav', sort: (r) => ORDER_STATUSES.indexOf(r.status) }
	];
</script>

<PageHeader title="Objednávky">
	{#snippet meta()}Ruční zřízení: kontaktovat, zřídit, předat přístupy. Cíl do 4 pracovních hodin.{/snippet}
</PageHeader>

<nav class="mb-3 flex gap-1 overflow-x-auto border-b border-line" aria-label="Filtr stavu">
	{#each tabs as t (t.key)}
		<a
			href="?stav={t.key}"
			data-sveltekit-replacestate
			aria-current={filter === t.key ? 'page' : undefined}
			class="-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-semibold whitespace-nowrap {filter === t.key
				? 'border-accent text-ink'
				: 'border-transparent text-muted hover:text-ink'}"
		>
			{t.label}<span class="mono text-xs text-muted">{t.n}</span>
		</a>
	{/each}
</nav>

<DataTable
	{rows}
	{columns}
	search={(r) => `${r.id} ${r.name} ${r.company} ${r.email} ${r.domain} ${r.plan}`}
	empty="Žádné objednávky v tomto stavu."
	initialSort={{ column: 6, dir: 'desc' }}
>
	{#snippet row(o)}
		<tr class="cursor-pointer" onclick={() => goto(`/admin/objednavky/${o.id}`)}>
			<td class="mono text-xs text-muted"><a href="/admin/objednavky/{o.id}" class="hover:underline">#{o.id}</a></td>
			<td>
				<div class="flex flex-wrap items-center gap-1.5 font-semibold">{o.company || o.name}{#if o.source === 'panel'}<SourceChip />{/if}</div>
				<div class="text-xs text-muted">{o.email}</div>
			</td>
			<td>{o.plan ?? 'Neznámý'} <span class="text-xs text-muted">{o.period === 'year' ? 'ročně' : 'měsíčně'}</span></td>
			<td class="mono text-xs">{o.domain || '·'}</td>
			<td class="mono text-right text-xs">{czk(o.priceMonthly)}</td>
			<td class="text-xs">{o.assignee ?? '·'}</td>
			<td class="text-xs text-muted" title={dateTime(o.createdAt)}>{ago(o.createdAt)}</td>
			<td><OrderStatus status={o.status} /></td>
		</tr>
	{/snippet}
</DataTable>
