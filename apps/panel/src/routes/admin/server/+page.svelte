<script lang="ts">
	import { enhance } from '$app/forms';
	import { keepResult } from '#lib/forms.ts';
	import { refreshAll } from '$app/navigation';
	import { RefreshCw } from '@lucide/svelte';
	import BrandIcon from '#lib/components/BrandIcon.svelte';
	import BrokerDown from '#lib/components/BrokerDown.svelte';
	import Button from '#lib/components/Button.svelte';
	import Empty from '#lib/components/Empty.svelte';
	import FormMessage from '#lib/components/FormMessage.svelte';
	import Led from '#lib/components/Led.svelte';
	import PageHeader from '#lib/components/PageHeader.svelte';
	import Panel from '#lib/components/Panel.svelte';
	import Pill from '#lib/components/Pill.svelte';
	import { companyBrand, techBrand, unitBrand } from '#lib/brands.ts';
	import { ago, bytes, dateTime } from '#lib/format.ts';
	import { BROKER_EVENT_LABEL, duration, meterTone, pct, UNIT_LABEL, unitTone } from '#lib/ops.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const n = $derived(data.node);
	const down = $derived(n ? n.services.filter((s) => s.state !== 'active') : []);
	let opening = $state(false);

	// While the update check runs, poll the snapshot so the result appears without a manual refresh.
	$effect(() => {
		if (!n?.updateRunning) return;
		const t = setInterval(() => refreshAll(), 3000);
		return () => clearInterval(t);
	});
</script>

<PageHeader title="Uzel vytvorit-web">
	{#snippet meta()}
		<span class="mono">2.31.25.249</span>
		<span class="inline-flex items-center gap-1.5"><BrandIcon name="hetzner" />Hetzner</span>
		<span class="inline-flex items-center gap-1.5"><BrandIcon name="ubuntu" />Ubuntu</span>
		<span class="inline-flex items-center gap-1.5"><BrandIcon name="cloudpanel" />CloudPanel</span>
		{#if n}<span title={dateTime(n.timestamp)}>data {ago(n.timestamp)}</span>{/if}
	{/snippet}
	{#snippet actions()}
		<Button size="sm" variant="ghost" onclick={() => refreshAll()}><RefreshCw size={14} /> Obnovit</Button>
		{#if data.cloudpanel && data.enabled}
			<form
				method="POST"
				action="?/cloudpanel"
				use:enhance={() => {
					opening = true;
					return async ({ result, update }) => {
						if (result.type === 'redirect') {
							window.location.assign(result.location);
							return;
						}
						opening = false;
						await update();
					};
				}}
			>
				<Button type="submit" size="sm" variant="primary" disabled={opening}>
					<BrandIcon name="cloudpanel" size={14} mono />
					{opening ? 'Otevírám' : 'Otevřít CloudPanel'}
				</Button>
			</form>
		{/if}
	{/snippet}
</PageHeader>

<FormMessage {form} />

{#if !n}
	<BrokerDown error={data.error} enabled={data.enabled} />
{:else}
	<div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
		{#each [{ label: 'Paměť', m: n.memory }, { label: 'Disk', m: n.disk }] as { label, m } (label)}
			{@const ratio = m.used / m.total}
			<div class="rounded-[6px] border border-line bg-surface px-4 py-3">
				<div class="flex items-baseline justify-between gap-2 text-xs">
					<span class="font-semibold text-muted">{label}</span>
					<span class="mono">{pct(ratio)}</span>
				</div>
				<div class="mono mt-1 text-[15px] font-medium">
					{bytes(m.used)} <span class="text-xs text-muted">/ {bytes(m.total)}</span>
				</div>
				<div
					class="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2"
					role="meter"
					aria-label={label}
					aria-valuemin={0}
					aria-valuemax={100}
					aria-valuenow={Math.round(ratio * 100)}
				>
					<div class="h-full rounded-full {meterTone(ratio)}" style="width: {pct(ratio)}"></div>
				</div>
			</div>
		{/each}
		<div class="rounded-[6px] border border-line bg-surface px-4 py-3">
			<div class="text-xs font-semibold text-muted">Zatížení / 2 vCPU</div>
			<div class="mono mt-1 text-[24px] leading-none font-medium">{n.load[0].toFixed(2)}</div>
			<div class="mono mt-1.5 text-xs text-muted">5 min {n.load[1].toFixed(2)} · 15 min {n.load[2].toFixed(2)}</div>
		</div>
		<div class="rounded-[6px] border border-line bg-surface px-4 py-3">
			<div class="text-xs font-semibold text-muted">Běží bez restartu</div>
			<div class="mono mt-1 text-[24px] leading-none font-medium">{duration(n.uptime)}</div>
			<div class="mt-1.5 text-xs text-muted">{n.sites} webů, {n.wordpress} WordPressů</div>
		</div>
	</div>

	<div class="mt-5 grid gap-5 [&>*]:min-w-0 xl:grid-cols-[1.5fr_1fr]">
		<Panel title="Služby systemd">
			{#snippet actions()}
				{#if down.length}
					<Pill tone="bad">{down.length} mimo provoz</Pill>
				{:else}
					<Pill tone="ok">vše běží</Pill>
				{/if}
			{/snippet}
			<ul class="grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
				{#each n.services as s (s.name)}
					{@const tone = unitTone(s.state)}
					{@const brand = unitBrand(s.name)}
					<li class="flex min-w-0 items-center gap-2 py-1 text-sm">
						<Led state={tone} pulse={tone === 'act'} label={UNIT_LABEL[s.state] ?? s.state} />
						{#if brand}<BrandIcon name={brand} size={14} />{:else}<span class="size-3.5 shrink-0" aria-hidden="true"></span>{/if}
						<span class="mono min-w-0 flex-1 truncate text-xs" title={s.name}>{s.name}</span>
						{#if s.state !== 'active'}
							<span class="text-xs font-semibold {tone === 'bad' ? 'text-bad' : 'text-accent'}">{UNIT_LABEL[s.state] ?? s.state}</span>
						{/if}
					</li>
				{/each}
			</ul>
			<p class="mt-3 border-t border-line pt-3 text-xs text-muted">
				Neaktivní PHP-FPM jiných verzí je v pořádku, pokud je žádný web nepoužívá. Síťová pravidla se spravují v Hetzner Cloud Firewallu.
			</p>
		</Panel>

		<Panel title="Node.js a Bun" flush>
			<table class="w-full text-sm">
				<tbody>
					{#each n.runtimes as r (r.name)}
						{@const brand = techBrand(r.name)}
						<tr class="border-b border-line last:border-b-0">
							<td class="px-4 py-2.5 font-semibold">
								<span class="inline-flex items-center gap-2">{#if brand}<BrandIcon name={brand} />{/if}{r.name}</span>
							</td>
							<td class="mono px-4 py-2.5 text-xs">{r.version}</td>
							<td class="px-4 py-2.5 text-right">
								<Pill tone={r.installed ? 'ok' : 'warn'}>{r.installed ? 'Nainstalováno' : 'Vyžaduje kontrolu'}</Pill>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
			<p class="border-t border-line px-4 py-3 text-xs text-muted">
				Nainstalovaný runtime neznamená, že konkrétní aplikace běží. Proces aplikace se nastavuje v CloudPanelu.
			</p>
		</Panel>
	</div>

	<Panel title="Aktualizace" class="mt-5">
		{#snippet actions()}
			<form method="POST" action="?/updateCheck" use:enhance={keepResult()}>
				<Button type="submit" size="sm" disabled={n.updateRunning}>
					<RefreshCw size={14} class={n.updateRunning ? 'animate-spin' : ''} />
					{n.updateRunning ? 'Probíhá kontrola' : 'Zkontrolovat aktualizace'}
				</Button>
			</form>
		{/snippet}
		<div class="flex flex-wrap items-center gap-2 text-sm">
			{#if n.updateRunning}<Pill tone="act">Kontrola běží</Pill>{/if}
			{#if n.updates}
				<span class="text-muted">
					Poslední dokončená kontrola <span class="text-ink" title={dateTime(n.updates.time)}>{ago(n.updates.time)}</span>{n.updateRunning
						? ', níže jsou předchozí výsledky'
						: ''}.
				</span>
			{/if}
			<span class="text-muted">Automaticky každý den kolem 06:00. Kontrola nic neinstaluje.</span>
		</div>

		{#if n.updates}
			{#if n.updates.rebootRequired || n.updates.errors.length}
				<ul class="mt-3 flex flex-col gap-2">
					{#if n.updates.rebootRequired}
						<li class="rounded-[6px] border border-warn/30 bg-warn-bg px-3 py-2 text-sm font-medium text-warn">
							Systém hlásí potřebu restartu serveru. Naplánujte ho mimo špičku.
						</li>
					{/if}
					{#each n.updates.errors as e, i (i)}
						<li class="rounded-[6px] border border-warn/30 bg-warn-bg px-3 py-2 text-sm text-warn">{e}</li>
					{/each}
				</ul>
			{/if}

			<div class="mt-4 grid gap-5 [&>*]:min-w-0 lg:grid-cols-2">
				<div class="min-w-0">
					<h3 class="mb-2 text-xs font-bold text-muted">Komponenty</h3>
					<div class="overflow-x-auto rounded-[6px] border border-line">
						<table class="w-full text-sm">
							<thead>
								<tr class="bg-surface-2 text-left text-xs text-muted">
									<th class="h-8 px-3 font-semibold">Technologie</th>
									<th class="h-8 px-3 font-semibold">Nainstalováno</th>
									<th class="h-8 px-3 font-semibold">Dostupná</th>
									<th class="relative h-8 px-3 font-semibold"><span class="sr-only">Stav</span></th>
								</tr>
							</thead>
							<tbody>
								{#each n.updates.components as c (c.name)}
									{@const fresh = c.status ? c.status === 'Aktuální' : c.current === c.latest}
									{@const brand = techBrand(c.name)}
									<tr class="border-t border-line">
										<td class="px-3 py-2">
											<div class="flex items-center gap-2 font-semibold">{#if brand}<BrandIcon name={brand} />{/if}{c.name}</div>
											{#if c.note}<div class="text-xs text-muted">{c.note}</div>{/if}
										</td>
										<td class="mono px-3 py-2 text-xs whitespace-nowrap">{c.current ?? '?'}</td>
										<td class="mono px-3 py-2 text-xs whitespace-nowrap">{c.latest ?? '?'}</td>
										<td class="px-3 py-2 text-right">
											<Pill tone={fresh ? 'ok' : c.status === 'Kontrola selhala' ? 'bad' : 'warn'}>{c.status ?? (fresh ? 'Aktuální' : 'Novější verze')}</Pill>
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				</div>
				<div class="min-w-0">
					<h3 class="mb-2 flex items-center gap-1.5 text-xs font-bold text-muted">
						<BrandIcon name="ubuntu" size={14} />
						Systémové balíčky:
						{#if n.updates.packages == null}aktuálnost nebyla ověřena{:else}{n.updates.packages.length} k aktualizaci{/if}
					</h3>
					{#if n.updates.packages?.length}
						<div class="max-h-72 overflow-auto rounded-[6px] border border-line">
							<table class="w-full text-sm">
								<thead class="sticky top-0">
									<tr class="bg-surface-2 text-left text-xs text-muted">
										<th class="h-8 px-3 font-semibold">Balíček</th>
										<th class="h-8 px-3 font-semibold">Nainstalováno</th>
										<th class="h-8 px-3 font-semibold">Dostupná</th>
									</tr>
								</thead>
								<tbody>
									{#each n.updates.packages as p (p.name)}
										<tr class="border-t border-line">
											<td class="mono px-3 py-1.5 text-xs font-semibold">{p.name}</td>
											<td class="mono px-3 py-1.5 text-xs whitespace-nowrap text-muted">{p.current}</td>
											<td class="mono px-3 py-1.5 text-xs whitespace-nowrap">{p.latest}</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
					{:else if n.updates.packages}
						<p class="text-sm text-muted">Všechny balíčky jsou aktuální.</p>
					{/if}

					{#if n.updates.wordpress.length}
						<h3 class="mt-4 mb-2 text-xs font-bold text-muted">WordPressy</h3>
						<ul class="flex flex-col gap-1.5 text-sm">
							{#each n.updates.wordpress as w (w.path)}
								<li class="flex flex-wrap items-baseline justify-between gap-x-3">
									<span class="mono min-w-0 truncate text-xs" title={w.path}>{w.path}</span>
									<span class="text-xs text-muted">
										{w.status}{#if w.status === 'Ověřeno'}: jádro {w.core}, pluginy {w.plugins}, šablony {w.themes}{/if}
									</span>
								</li>
							{/each}
						</ul>
					{/if}
				</div>
			</div>
		{:else}
			<p class="mt-3 rounded-[6px] border border-warn/30 bg-warn-bg px-3 py-2 text-sm text-warn">
				Kontrola ještě nebyla dokončena. Spusťte ji tlačítkem nahoře.
			</p>
		{/if}
	</Panel>

	<div class="mt-5 grid gap-5 [&>*]:min-w-0 xl:grid-cols-2">
		<Panel title="Poslední údržba WordPressu" brand="wordpress" flush>
			{#snippet actions()}<a class="text-xs font-semibold text-accent hover:underline" href="/admin/wordpress">WordPress</a>{/snippet}
			{#if n.logs}
				<pre class="mono max-h-80 overflow-auto p-4 text-[11px] leading-relaxed whitespace-pre text-ink">{n.logs}</pre>
			{:else}
				<Empty title="Údržba zatím neběžela" />
			{/if}
		</Panel>

		<Panel title="Události brokeru" flush>
			{#if n.events.length}
				<ul class="max-h-80 overflow-y-auto">
					{#each n.events as e, i (i)}
						<li class="flex items-baseline gap-3 border-b border-line px-4 py-2 text-sm last:border-b-0">
							<span class="w-28 shrink-0 text-xs whitespace-nowrap text-muted" title={dateTime(e.time)}>{ago(e.time)}</span>
							<span class="min-w-0 flex-1">
								<span class="font-semibold {e.action === 'error' || e.action.endsWith('_failed') ? 'text-bad' : ''}">{BROKER_EVENT_LABEL[e.action] ?? e.action}</span>
								{#if e.details}<span class="block truncate text-xs text-muted" title={e.details}>{e.details}</span>{/if}
							</span>
						</li>
					{/each}
				</ul>
			{:else}
				<Empty title="Zatím žádné události" />
			{/if}
		</Panel>
	</div>
{/if}

<Panel title="Uzly" class="mt-5" flush>
	{#if data.nodes.length}
		<div class="overflow-x-auto">
			<table class="w-full text-sm">
				<thead>
					<tr class="bg-surface-2 text-left text-xs text-muted">
						<th class="h-9 px-4 font-semibold">Název</th>
						<th class="h-9 px-4 font-semibold">Host</th>
						<th class="h-9 px-4 font-semibold">Poskytovatel</th>
						<th class="h-9 px-4 font-semibold">Lokalita</th>
						<th class="h-9 px-4 font-semibold">Správa</th>
						<th class="h-9 px-4 font-semibold">Poznámka</th>
					</tr>
				</thead>
				<tbody>
					{#each data.nodes as node (node.id)}
						{@const provider = companyBrand(node.provider)}
						<tr class="border-t border-line">
							<td class="px-4 py-2.5 font-semibold whitespace-nowrap">{node.name}</td>
							<td class="mono px-4 py-2.5 text-xs">{node.host}</td>
							<td class="px-4 py-2.5">
								<span class="inline-flex items-center gap-2 whitespace-nowrap">{#if provider}<BrandIcon name={provider} />{/if}{node.provider}</span>
							</td>
							<td class="px-4 py-2.5">{node.location || '·'}</td>
							<td class="px-4 py-2.5 whitespace-nowrap">
								<Pill tone={node.local ? 'ok' : 'off'}>{node.local ? 'Přes broker' : 'Jen evidence'}</Pill>
							</td>
							<td class="px-4 py-2.5 text-xs text-muted">{node.note ?? ''}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
		<p class="border-t border-line px-4 py-3 text-xs text-muted">
			Ovládat jde jen uzel, na kterém panel běží (lokální broker). Další uzly jsou zatím jen v evidenci.
		</p>
	{:else}
		<Empty title="Žádné uzly v evidenci" />
	{/if}
</Panel>
