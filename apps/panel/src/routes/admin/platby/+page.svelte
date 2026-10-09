<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { RefreshCw } from '@lucide/svelte';
	import Button from '#lib/components/Button.svelte';
	import DataTable from '#lib/components/DataTable.svelte';
	import PageHeader from '#lib/components/PageHeader.svelte';
	import PaymentStatus from '#lib/components/PaymentStatus.svelte';
	import type { Column } from '#lib/components/table.ts';
	import { czk, date, dateTime } from '#lib/format.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	type Row = (typeof data.payments)[number];

	const overdue = (r: Row) => r.status === 'unpaid' && r.dueDate < data.today;
	const FILTERS: Record<string, { label: string; test: (r: Row) => boolean }> = {
		unpaid: { label: 'K úhradě', test: (r) => r.status === 'unpaid' },
		overdue: { label: 'Po splatnosti', test: overdue },
		paid: { label: 'Zaplaceno', test: (r) => r.status === 'paid' },
		cancelled: { label: 'Zrušeno', test: (r) => r.status === 'cancelled' },
		all: { label: 'Vše', test: () => true }
	};
	const filter = $derived(FILTERS[page.url.searchParams.get('stav') ?? ''] ? page.url.searchParams.get('stav')! : 'unpaid');
	const rows = $derived(data.payments.filter(FILTERS[filter].test));
	const tabs = $derived(Object.entries(FILTERS).map(([key, f]) => ({ key, label: f.label, n: data.payments.filter(f.test).length })));
	const toCollect = $derived(data.payments.filter((r) => r.status === 'unpaid').reduce((sum, r) => sum + r.amount, 0));

	const columns: Column<Row>[] = [
		{ label: 'VS', sort: (r) => r.vs },
		{ label: 'Zákazník', sort: (r) => r.company || r.customer },
		{ label: 'Za co', sort: (r) => r.description },
		{ label: 'Částka', sort: (r) => r.amount, align: 'right' },
		{ label: 'Splatnost', sort: (r) => r.dueDate },
		{ label: 'Stav', sort: (r) => (overdue(r) ? 0 : r.status === 'unpaid' ? 1 : r.status === 'paid' ? 2 : 3) },
		{ label: 'Zaplaceno', sort: (r) => r.paidAt?.getTime() ?? null }
	];
</script>

<PageHeader title="Platby">
	{#snippet meta()}Zálohové výzvy k platbě. Úhradu zkontrolujte na výpisu a označte ručně.{/snippet}
	{#snippet actions()}
		<Button href="/admin/platby/obnovy" variant="primary"><RefreshCw size={15} />Vystavit výzvy k obnově</Button>
	{/snippet}
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
			{t.label}<span class="mono text-xs {t.key === 'overdue' && t.n ? 'text-bad' : 'text-muted'}">{t.n}</span>
		</a>
	{/each}
</nav>

<DataTable
	{rows}
	{columns}
	search={(r) => `${r.vs} ${r.customer} ${r.company} ${r.description} ${r.invoiceRef}`}
	empty="Žádné výzvy v tomto stavu."
	initialSort={filter === 'paid' ? { column: 6, dir: 'desc' } : { column: 4, dir: 'asc' }}
>
	{#snippet toolbar()}
		{#if toCollect}<span class="text-xs text-muted">Celkem k úhradě <span class="mono font-semibold text-ink">{czk(toCollect)}</span></span>{/if}
	{/snippet}
	{#snippet row(p)}
		<tr class="cursor-pointer" onclick={() => goto(`/admin/platby/${p.id}`)}>
			<td class="mono text-xs"><a href="/admin/platby/{p.id}" class="hover:underline">{p.vs}</a></td>
			<td class="min-w-40">
				<a href="/admin/zakaznici/{p.customerId}" class="font-semibold hover:underline" onclick={(e) => e.stopPropagation()}>{p.company || p.customer}</a>
			</td>
			<td class="min-w-56 text-xs">{p.description}</td>
			<td class="mono text-right text-xs whitespace-nowrap">{czk(p.amount)}</td>
			<td class="mono text-xs whitespace-nowrap {overdue(p) ? 'font-semibold text-bad' : ''}">{date(p.dueDate)}</td>
			<td><PaymentStatus status={p.status} dueDate={p.dueDate} /></td>
			<td class="text-xs whitespace-nowrap text-muted">
				{#if p.paidAt}<span title={dateTime(p.paidAt)}>{date(p.paidAt)}</span>{#if p.invoiceRef}<div class="mono">{p.invoiceRef}</div>{/if}{:else}·{/if}
			</td>
		</tr>
	{/snippet}
</DataTable>
