<script lang="ts">
	import { enhance } from '$app/forms';
	import { keepResult } from '#lib/forms.ts';
	import { ExternalLink, RefreshCw } from '@lucide/svelte';
	import Button from '#lib/components/Button.svelte';
	import DataTable from '#lib/components/DataTable.svelte';
	import Empty from '#lib/components/Empty.svelte';
	import FormMessage from '#lib/components/FormMessage.svelte';
	import Led from '#lib/components/Led.svelte';
	import PageHeader from '#lib/components/PageHeader.svelte';
	import Panel from '#lib/components/Panel.svelte';
	import Pill from '#lib/components/Pill.svelte';
	import Stat from '#lib/components/Stat.svelte';
	import type { Column } from '#lib/components/table.ts';
	import { KIND_LABEL } from '#lib/format.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	type Row = (typeof data.services)[number];
	let writing = $state(false);

	const columns: Column<Row>[] = [
		{ label: 'Služba', sort: (r) => r.domain },
		{ label: 'Zákazník', sort: (r) => r.company || r.customer },
		{ label: 'Stav', sort: (r) => (r.health.up == null ? null : r.health.up ? 1 : 0) },
		{ label: 'Dostupnost 30 dní', sort: (r) => r.health.uptime30d, align: 'right' },
		{ label: 'Odezva', sort: (r) => r.health.latencyMs, align: 'right' },
		{ label: 'SSL', sort: (r) => r.health.sslDays, align: 'right' }
	];
	const down = $derived(data.services.filter((s) => s.health.up === false).length);
	const sslSoon = $derived(data.services.filter((s) => s.health.sslDays != null && s.health.sslDays < 14).length);
	const uptimeTone = (n: number | null) => (n == null ? '' : n < 99 ? 'text-bad' : n < 99.9 ? 'text-warn' : '');
</script>

<PageHeader title="Monitoring">
	{#snippet meta()}Blackbox sondy na aktivní služby zákazníků (Alloy, Prometheus).{/snippet}
	{#snippet actions()}
		{#if data.grafana}
			<Button size="sm" href={data.grafana} target="_blank" rel="noreferrer"><ExternalLink size={14} /> Otevřít Grafanu</Button>
		{/if}
		<form
			method="POST"
			action="?/probes"
			use:enhance={(input) => {
				writing = true;
				return keepResult({ onDone: () => (writing = false) })(input);
			}}
		>
			<Button type="submit" size="sm" variant="primary" disabled={writing || !data.probesFile} title={data.probesFile ? undefined : 'PROBES_FILE není nastavený'}>
				<RefreshCw size={14} class={writing ? 'animate-spin' : ''} /> Přegenerovat cíle monitoringu
			</Button>
		</form>
	{/snippet}
</PageHeader>

<FormMessage {form} />

{#if !data.metrics}
	<Panel class="mb-5">
		<Empty title="Metriky nejsou připojené">
			Není nastavený <span class="mono">PROMETHEUS_URL</span>, takže panel nezná stav sond. Seznam níže ukazuje, co se monitoruje; cíle se do souboru pro
			Alloy zapisují i bez Prometheu.
		</Empty>
	</Panel>
{:else}
	<div class="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
		<Stat label="Monitorovaných služeb" value={data.services.length} />
		<Stat label="Nedostupné" value={down} />
		<Stat label="SSL do 14 dní" value={sslSoon} />
		<Stat label="Zdroj" value="Prometheus" hint="sonda každou minutu" />
	</div>
{/if}

<DataTable
	rows={data.services}
	{columns}
	search={(r) => `${r.domain} ${r.label} ${r.customer} ${r.company}`}
	empty="Žádná aktivní služba se nemonitoruje."
	initialSort={{ column: 0, dir: 'asc' }}
>
	{#snippet row(s)}
		{@const h = s.health}
		<tr>
			<td>
				<a class="font-semibold hover:underline" href="/admin/sluzby/{s.id}">{s.domain}</a>
				<div class="text-xs text-muted">{s.label} · {KIND_LABEL[s.kind] ?? s.kind}</div>
			</td>
			<td class="text-sm"><a class="hover:underline" href="/admin/zakaznici/{s.customerId}">{s.company || s.customer}</a></td>
			<td class="whitespace-nowrap">
				{#if h.up == null}<span class="flex items-center gap-2 text-xs text-muted"><Led state="off" /> Bez dat</span>
				{:else if h.up}<Pill tone="ok">Dostupné</Pill>
				{:else}<Pill tone="bad">Nedostupné</Pill>{/if}
			</td>
			<td class="mono text-right text-xs {uptimeTone(h.uptime30d)}">{h.uptime30d == null ? '·' : `${h.uptime30d.toFixed(2).replace('.', ',')} %`}</td>
			<td class="mono text-right text-xs">{h.latencyMs == null ? '·' : `${h.latencyMs} ms`}</td>
			<td class="mono text-right text-xs {h.sslDays != null && h.sslDays < 14 ? 'font-semibold text-bad' : ''}">{h.sslDays == null ? '·' : `${h.sslDays} d`}</td>
		</tr>
	{/snippet}
</DataTable>
<p class="mt-2 text-xs text-muted">
	Sledují se aktivní služby s doménou a zapnutým monitoringem. Cíle se přegenerují samy při změně služby; tlačítko je pro jistotu po ručních zásazích.
</p>
