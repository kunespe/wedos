<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { Plus } from '@lucide/svelte';
	import Button from '#lib/components/Button.svelte';
	import DataTable from '#lib/components/DataTable.svelte';
	import PageHeader from '#lib/components/PageHeader.svelte';
	import Pill from '#lib/components/Pill.svelte';
	import type { Column } from '#lib/components/table.ts';
	import { TICKET_STATUSES } from '#lib/constants.ts';
	import { ago, dateTime, TICKET_STATUS_LABEL } from '#lib/format.ts';
	import Contact from '../Contact.svelte';
	import { TICKET_TONE } from '../tones.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	type Row = (typeof data.tickets)[number];

	const filter = $derived(page.url.searchParams.get('stav') ?? 'active');
	const active = $derived(data.tickets.filter((t) => t.status !== 'closed'));
	const rows = $derived(
		filter === 'all' ? data.tickets : filter === 'closed' ? data.tickets.filter((t) => t.status === 'closed') : active
	);
	const tabs = $derived([
		{ key: 'active', label: 'Rozpracované', n: active.length },
		{ key: 'closed', label: 'Uzavřené', n: data.tickets.length - active.length },
		{ key: 'all', label: 'Vše', n: data.tickets.length }
	]);

	const columns: Column<Row>[] = [
		{ label: 'Č.', sort: (r) => r.id },
		{ label: 'Předmět', sort: (r) => r.subject },
		{ label: 'Služba', sort: (r) => r.service },
		{ label: 'Poslední změna', sort: (r) => r.updatedAt.getTime() },
		{ label: 'Stav', sort: (r) => TICKET_STATUSES.indexOf(r.status) }
	];
</script>

<PageHeader title="Podpora">
	{#snippet meta()}Vaše požadavky a naše odpovědi.{/snippet}
	{#snippet actions()}
		<Button href="/app/podpora/novy" variant="primary"><Plus size={15} />Nový požadavek</Button>
	{/snippet}
</PageHeader>

<div class="grid gap-5 xl:grid-cols-[1fr_300px]">
	<div class="min-w-0">
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

		<DataTable {rows} {columns} search={(r) => `${r.id} ${r.subject} ${r.service ?? ''}`} empty="Žádné požadavky." initialSort={{ column: 3, dir: 'desc' }}>
			{#snippet row(t)}
				<tr class="cursor-pointer" onclick={() => goto(`/app/podpora/${t.id}`)}>
					<td class="mono text-xs text-muted"><a href="/app/podpora/{t.id}" class="hover:underline">#{t.id}</a></td>
					<td class="min-w-48 font-semibold">{t.subject}</td>
					<td class="text-xs">{t.service ?? '·'}</td>
					<td class="text-xs whitespace-nowrap text-muted" title={dateTime(t.updatedAt)}>{ago(t.updatedAt)}</td>
					<td><Pill tone={TICKET_TONE[t.status]}>{TICKET_STATUS_LABEL[t.status]}</Pill></td>
				</tr>
			{/snippet}
		</DataTable>
	</div>

	<div class="min-w-0"><Contact /></div>
</div>
