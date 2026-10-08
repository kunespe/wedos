<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import DataTable from '#lib/components/DataTable.svelte';
	import Led from '#lib/components/Led.svelte';
	import PageHeader from '#lib/components/PageHeader.svelte';
	import type { Column } from '#lib/components/table.ts';
	import { SERVICE_KINDS, SERVICE_STATUSES } from '#lib/constants.ts';
	import { czk, date, daysUntil, KIND_LABEL, SERVICE_STATUS_LABEL } from '#lib/format.ts';
	import ServiceStatus from './ServiceStatus.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	type Row = (typeof data.services)[number];

	const kind = $derived(page.url.searchParams.get('typ') ?? '');
	const status = $derived(page.url.searchParams.get('stav') ?? '');
	const rows = $derived(data.services.filter((s) => (!kind || s.kind === kind) && (!status || s.status === status)));

	function setFilter(key: string, value: string) {
		const url = new URL(page.url.href);
		if (value) url.searchParams.set(key, value);
		else url.searchParams.delete(key);
		goto(url, { replace: true, reset: false });
	}

	const columns: Column<Row>[] = [
		{ label: '', class: 'w-6' },
		{ label: 'Služba', sort: (r) => r.label },
		{ label: 'Zákazník', sort: (r) => r.company || r.customer },
		{ label: 'Typ', sort: (r) => r.kind },
		{ label: 'Uzel', sort: (r) => r.node },
		{ label: 'Cena / měs.', sort: (r) => r.priceMonthly, align: 'right' },
		{ label: 'Expirace', sort: (r) => r.expiresAt },
		{ label: 'Stav', sort: (r) => r.status }
	];
</script>

<PageHeader title="Služby">
	{#snippet meta()}Každá služba patří jednomu zákazníkovi. Nové vznikají z objednávek.{/snippet}
</PageHeader>

<DataTable {rows} {columns} search={(r) => `${r.label} ${r.domain} ${r.customer} ${r.company}`} empty="Žádné služby." initialSort={{ column: 6, dir: 'asc' }}>
	{#snippet toolbar()}
		<select class="input w-auto" aria-label="Typ" value={kind} onchange={(e) => setFilter('typ', e.currentTarget.value)}>
			<option value="">Všechny typy</option>
			{#each SERVICE_KINDS as k (k)}<option value={k}>{KIND_LABEL[k]}</option>{/each}
		</select>
		<select class="input w-auto" aria-label="Stav" value={status} onchange={(e) => setFilter('stav', e.currentTarget.value)}>
			<option value="">Všechny stavy</option>
			{#each SERVICE_STATUSES as s (s)}<option value={s}>{SERVICE_STATUS_LABEL[s]}</option>{/each}
		</select>
	{/snippet}
	{#snippet row(s)}
		{@const d = daysUntil(s.expiresAt)}
		<tr class="cursor-pointer" onclick={() => goto(`/admin/sluzby/${s.id}`)}>
			<td><Led state={s.up == null ? 'off' : s.up ? 'ok' : 'bad'} label={s.up == null ? 'Bez měření' : s.up ? 'Dostupná' : 'Nedostupná'} /></td>
			<td>
				<a class="font-semibold hover:underline" href="/admin/sluzby/{s.id}">{s.label}</a>
				{#if s.domain}<div class="mono text-xs text-muted">{s.domain}</div>{/if}
			</td>
			<td class="text-xs"><a class="hover:underline" href="/admin/zakaznici/{s.customerId}" onclick={(e) => e.stopPropagation()}>{s.company || s.customer}</a></td>
			<td class="text-xs">{KIND_LABEL[s.kind]}</td>
			<td class="text-xs text-muted">{s.node ?? '·'}</td>
			<td class="mono text-right text-xs">{czk(s.priceMonthly)}</td>
			<td class="mono text-xs {d != null && d < 0 ? 'text-bad' : d != null && d <= 14 ? 'text-warn' : 'text-muted'}">
				{s.expiresAt ? date(s.expiresAt) : '·'}{s.manualHold ? ' · drženo' : ''}
			</td>
			<td><ServiceStatus status={s.status} /></td>
		</tr>
	{/snippet}
</DataTable>
