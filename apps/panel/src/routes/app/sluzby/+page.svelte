<script lang="ts">
	import { goto } from '$app/navigation';
	import DataTable from '#lib/components/DataTable.svelte';
	import Led from '#lib/components/Led.svelte';
	import PageHeader from '#lib/components/PageHeader.svelte';
	import Pill from '#lib/components/Pill.svelte';
	import type { Column } from '#lib/components/table.ts';
	import { SERVICE_STATUSES } from '#lib/constants.ts';
	import { czk, date, KIND_LABEL, periodTotal, SERVICE_STATUS_LABEL } from '#lib/format.ts';
	import { expiryHint, expiryTone, SERVICE_TONE, TEXT_TONE } from '../tones.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	type Row = (typeof data.services)[number];

	const columns: Column<Row>[] = [
		{ label: 'Služba', sort: (r) => r.label },
		{ label: 'Doména', sort: (r) => r.domain },
		{ label: 'Web', class: 'w-16' },
		{ label: 'Cena bez DPH', sort: (r) => r.priceMonthly, align: 'right' },
		{ label: 'Platí do', sort: (r) => r.expiresAt },
		{ label: 'Stav', sort: (r) => SERVICE_STATUSES.indexOf(r.status) }
	];
</script>

<PageHeader title="Služby">
	{#snippet meta()}Všechno, co pro vás provozujeme.{/snippet}
</PageHeader>

<DataTable rows={data.services} {columns} search={(r) => `${r.label} ${r.domain} ${r.plan ?? ''}`} empty="Zatím tu nemáte žádnou službu.">
	{#snippet row(s)}
		{@const h = data.health[s.id]}
		{@const tone = expiryTone(s.expiresAt)}
		<tr class="cursor-pointer" onclick={() => goto(`/app/sluzby/${s.id}`)}>
			<td class="min-w-48">
				<a href="/app/sluzby/{s.id}" class="font-semibold hover:underline">{s.label}</a>
				<div class="text-xs text-muted">{KIND_LABEL[s.kind]}{s.plan ? ` · ${s.plan}` : ''}</div>
			</td>
			<td class="mono text-xs">{s.domain || '·'}</td>
			<td>
				{#if h && h.up != null}
					<span class="flex items-center gap-1.5 text-xs"><Led state={h.up ? 'ok' : 'bad'} />{h.up ? 'OK' : 'Výpadek'}</span>
				{:else}
					<span class="text-xs text-muted">·</span>
				{/if}
			</td>
			<td class="mono text-right text-xs whitespace-nowrap">
				{#if s.priceMonthly == null}
					Individuálně
				{:else}
					{czk(periodTotal(s.priceMonthly, s.period))}
					<span class="text-muted">/ {s.period === 'year' ? 'rok' : 'měs.'}</span>
				{/if}
			</td>
			<td class="text-xs whitespace-nowrap">
				<span class="mono">{date(s.expiresAt)}</span>
				{#if s.expiresAt}<div class={TEXT_TONE[tone]}>{expiryHint(s.expiresAt)}</div>{/if}
			</td>
			<td><Pill tone={SERVICE_TONE[s.status]}>{SERVICE_STATUS_LABEL[s.status]}</Pill></td>
		</tr>
	{/snippet}
</DataTable>
