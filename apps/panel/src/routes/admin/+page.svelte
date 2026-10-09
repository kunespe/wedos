<script lang="ts">
	import Led from '#lib/components/Led.svelte';
	import PageHeader from '#lib/components/PageHeader.svelte';
	import Panel from '#lib/components/Panel.svelte';
	import Pill from '#lib/components/Pill.svelte';
	import Stat from '#lib/components/Stat.svelte';
	import Empty from '#lib/components/Empty.svelte';
	import OrderStatus from './objednavky/OrderStatus.svelte';
	import { ago, czk, date, daysUntil } from '#lib/format.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const pct = (n: number) => `${Math.round(n * 100)} %`;
	const meterTone = (n: number) => (n > 0.9 ? 'bg-bad' : n > 0.75 ? 'bg-amber' : 'bg-led');
	const greeting = $derived.by(() => {
		const h = Number(new Intl.DateTimeFormat('cs-CZ', { hour: 'numeric', timeZone: 'Europe/Prague' }).format(new Date()));
		return h < 10 ? 'Dobré ráno' : h < 18 ? 'Dobrý den' : 'Dobrý večer';
	});
</script>

<PageHeader title="{greeting}, {data.user.name.split(' ')[0]}">
	{#snippet meta()}Co dnes čeká na ruce.{/snippet}
</PageHeader>

<div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
	<Stat label="Rozpracované objednávky" value={data.stats.openOrders} href="/admin/objednavky" hint="nové, kontaktované, ve zřizování" />
	<Stat label="Aktivní služby" value={data.stats.active} href="/admin/sluzby" />
	<Stat label="MRR bez DPH" value={czk(data.stats.mrr)} hint="součet měsíčních cen aktivních služeb" />
	<Stat label="Otevřené tikety" value={data.stats.openTickets} href="/admin/tikety" />
</div>

<div class="mt-5 grid gap-5 xl:grid-cols-[1.6fr_1fr]">
	<Panel title="Poslední objednávky" flush>
		{#snippet actions()}<a class="text-xs font-semibold text-accent hover:underline" href="/admin/objednavky">Všechny</a>{/snippet}
		{#if data.recentOrders.length}
			<ul>
				{#each data.recentOrders as o (o.id)}
					<li class="border-b border-line last:border-b-0">
						<a href="/admin/objednavky/{o.id}" class="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-2">
							<span class="mono w-10 text-xs text-muted">#{o.id}</span>
							<span class="min-w-0 flex-1">
								<span class="block truncate font-semibold">{o.company || o.name}</span>
								<span class="block truncate text-xs text-muted">{o.plan ?? 'Neznámý tarif'}{o.domain ? ` · ${o.domain}` : ''}</span>
							</span>
							<span class="hidden text-xs text-muted sm:block">{ago(o.createdAt)}</span>
							<OrderStatus status={o.status} />
						</a>
					</li>
				{/each}
			</ul>
		{:else}
			<Empty title="Zatím žádné objednávky">Objednávky z webu serveros.cz se objeví tady.</Empty>
		{/if}
	</Panel>

	<div class="flex flex-col gap-5">
		<Panel title="Uzel vytvorit-web">
			{#snippet actions()}<a class="text-xs font-semibold text-accent hover:underline" href="/admin/server">Detail</a>{/snippet}
			{#if data.node}
				<div class="flex flex-col gap-3 text-sm">
					{#each [['Paměť', data.node.memory], ['Disk', data.node.disk]] as [label, v] (label)}
						<div>
							<div class="mb-1 flex justify-between text-xs"><span class="text-muted">{label}</span><span class="mono">{pct(Number(v))}</span></div>
							<div class="h-1.5 overflow-hidden rounded-full bg-surface-2">
								<div class="h-full rounded-full {meterTone(Number(v))}" style="width: {pct(Number(v))}"></div>
							</div>
						</div>
					{/each}
					<div class="flex flex-wrap items-center gap-2 pt-1">
						{#if data.node.failed.length}
							<Pill tone="bad">Neběží: {data.node.failed.join(', ')}</Pill>
						{:else}
							<Pill tone="ok">Všechny služby běží</Pill>
						{/if}
						{#if data.node.updates}<Pill tone="warn">{data.node.updates} aktualizací</Pill>{/if}
						<span class="mono ml-auto text-xs text-muted">load {data.node.load.toFixed(2)}</span>
					</div>
				</div>
			{:else}
				<p class="flex items-center gap-2 text-sm text-muted">
					<Led state={data.brokerEnabled ? 'bad' : 'off'} />
					{data.snapError ?? 'Serverové operace nejsou v tomto prostředí zapnuté.'}
				</p>
			{/if}
		</Panel>

		<Panel title="Expirace do 30 dní" flush>
			{#if data.expiringServices.length || data.expiringDomains.length}
				<ul class="text-sm">
					{#each data.expiringServices as s (s.id)}
						{@const d = daysUntil(s.expiresAt)}
						<li class="flex items-center gap-3 border-b border-line px-4 py-2 last:border-b-0">
							<Led state={d != null && d < 0 ? 'bad' : 'warn'} />
							<a class="min-w-0 flex-1 truncate hover:underline" href="/admin/sluzby/{s.id}">{s.label}<span class="text-muted"> · {s.customer}</span></a>
							<span class="mono text-xs {d != null && d < 0 ? 'text-bad' : 'text-muted'}">{date(s.expiresAt)}</span>
						</li>
					{/each}
					{#each data.expiringDomains as dm (dm.id)}
						<li class="flex items-center gap-3 border-b border-line px-4 py-2 last:border-b-0">
							<Led state="warn" />
							<a class="mono min-w-0 flex-1 truncate hover:underline" href="/admin/domeny/{dm.id}">{dm.name}</a>
							<span class="mono text-xs text-muted">{date(dm.expiresAt)}</span>
						</li>
					{/each}
				</ul>
			{:else}
				<Empty title="Nic nevyprší" />
			{/if}
		</Panel>
	</div>
</div>
