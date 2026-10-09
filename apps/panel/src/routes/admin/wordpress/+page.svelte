<script lang="ts">
	import { enhance, type SubmitFunction } from '$app/forms';
	import { keepResult } from '#lib/forms.ts';
	import { Play, TriangleAlert } from '@lucide/svelte';
	import BrandIcon from '#lib/components/BrandIcon.svelte';
	import BrokerDown from '#lib/components/BrokerDown.svelte';
	import Button from '#lib/components/Button.svelte';
	import Empty from '#lib/components/Empty.svelte';
	import FormMessage from '#lib/components/FormMessage.svelte';
	import Led from '#lib/components/Led.svelte';
	import PageHeader from '#lib/components/PageHeader.svelte';
	import Panel from '#lib/components/Panel.svelte';
	import Pill from '#lib/components/Pill.svelte';
	import { ago, dateTime } from '#lib/format.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const wp = $derived(data.wp);
	let busy = $state<'settings' | 'run' | null>(null);

	const busyEnhance =
		(which: 'settings' | 'run'): SubmitFunction =>
		(input) => {
			busy = which;
			return keepResult({ onDone: () => (busy = null) })(input);
		};
</script>

<PageHeader title="WordPress">
	{#snippet meta()}<span><BrandIcon name="wordpress" class="mr-1" />Zálohy a aktualizace instalací na uzlu vytvorit-web, každý den kolem 03:30.</span>{/snippet}
</PageHeader>

<FormMessage {form} />

{#if !wp}
	<BrokerDown error={data.error} enabled={data.enabled} />
{:else}
	{#if !wp.s3Ready}
		<section class="mb-5 flex gap-3 rounded-[6px] border border-warn/40 bg-warn-bg p-4 text-sm" aria-labelledby="s3-title">
			<TriangleAlert size={18} class="mt-0.5 shrink-0 text-warn" />
			<div>
				<h2 id="s3-title" class="font-bold text-warn">Aktualizace se přeskakují: S3 není připojené a ověřené</h2>
				<p class="mt-1">
					Údržba vždy nejdřív zazálohuje databázi a soubory, zálohu šifrovaně nahraje do S3 a zpětným stažením ověří její kontrolní součet. Teprve
					potom aktualizuje. Konfigurace vyžaduje zálohu mimo server, takže bez ověřeného S3 se aktualizace u každého webu přeskočí (v logu
					<span class="mono">S3 backup is not configured and verified</span>). Weby dál běží, jen zůstávají na současných verzích.
				</p>
				<p class="mt-1 text-muted">
					Připojení: vyplnit <span class="mono">/etc/vytvorit-web/s3-backup.json</span>, spustit <span class="mono">vytvorit-web-s3 init</span> a
					<span class="mono">verify</span>. Podrobnosti v sekci <a class="underline" href="/admin/zalohy">Zálohy</a>.
				</p>
			</div>
		</section>
	{/if}

	<div class="grid gap-5 [&>*]:min-w-0 lg:grid-cols-[1fr_1.4fr]">
		<Panel title="Automatická údržba">
			<div class="flex items-center gap-2.5">
				<Led state={wp.automation ? (wp.s3Ready ? 'ok' : 'warn') : 'off'} />
				<span class="text-[15px] font-bold">
					{wp.automation ? (wp.s3Ready ? 'Zapnutá' : 'Zapnutá, čeká na S3') : 'Vypnutá'}
				</span>
			</div>
			<ul class="mt-3 flex flex-col gap-1 text-sm text-muted">
				<li>Záloha databáze a souborů před každou aktualizací</li>
				<li>Menší vydání jádra v rámci hlavní řady, pluginy a šablony</li>
				<li>Ověření kontrolních součtů jádra po aktualizaci</li>
				<li>Při nedostatku místa nebo chybě zálohy se web přeskočí</li>
				<li>Pozastavené weby jsou z plánu vyřazené</li>
			</ul>
			<div class="mt-4 flex flex-wrap gap-2 border-t border-line pt-4">
				<form method="POST" action="?/settings" use:enhance={busyEnhance('settings')}>
					<input type="hidden" name="enabled" value={wp.automation ? 'false' : 'true'} />
					<Button type="submit" variant={wp.automation ? 'secondary' : 'primary'} disabled={busy === 'settings'}>
						{wp.automation ? 'Vypnout automatiku' : 'Zapnout automatiku'}
					</Button>
				</form>
				<form method="POST" action="?/run" use:enhance={busyEnhance('run')}>
					<Button type="submit" disabled={busy === 'run' || !wp.installs.length || !wp.automation} title={!wp.automation ? 'Nejdřív zapněte automatiku' : undefined}>
						<Play size={14} />
						{busy === 'run' ? 'Spouštím' : 'Spustit údržbu teď'}
					</Button>
				</form>
			</div>
			{#if !wp.automation}
				<p class="mt-2 text-xs text-muted">Ruční spuštění respektuje stejné nastavení, proto je s vypnutou automatikou nedostupné.</p>
			{/if}
		</Panel>

		<Panel title="Instalace" brand="wordpress" flush>
			{#if wp.installs.length}
				<div class="overflow-x-auto">
					<table class="w-full text-sm">
						<thead>
							<tr class="bg-surface-2 text-left text-xs text-muted">
								<th class="h-9 px-4 font-semibold">Web</th>
								<th class="h-9 px-4 font-semibold">Verze</th>
								<th class="h-9 px-4 font-semibold">Plán</th>
								<th class="h-9 px-4 font-semibold">Čeká</th>
								<th class="h-9 px-4 font-semibold">Poslední záloha</th>
							</tr>
						</thead>
						<tbody>
							{#each wp.installs as w (w.path)}
								<tr class="border-t border-line">
									<td class="px-4 py-2">
										<div class="font-semibold">{w.domain}</div>
										<div class="mono max-w-64 truncate text-[11px] text-muted" title={w.path}>{w.path}</div>
									</td>
									<td class="mono px-4 py-2 text-xs">{w.version}</td>
									<td class="px-4 py-2 whitespace-nowrap">
										{#if w.excluded}
											<Pill tone="off">{w.suspended ? 'Vyřazeno, pozastavený' : 'Vyřazeno'}</Pill>
										{:else}
											<Pill tone="ok">Podle plánu</Pill>
										{/if}
									</td>
									<td class="px-4 py-2 text-xs whitespace-nowrap">
										{#if !w.check}<span class="text-muted">neověřeno</span>
										{:else if w.check.status !== 'Ověřeno'}<span class="text-muted">{w.check.status}</span>
										{:else if w.check.pending}<span class="font-semibold text-warn">{w.check.pending} aktualizací</span>
										{:else}<span class="text-ok">aktuální</span>{/if}
									</td>
									<td class="px-4 py-2 text-xs whitespace-nowrap">
										{#if w.backup}
											<span class={w.backup.success ? '' : 'font-semibold text-bad'} title={dateTime(w.backup.time)}>
												{ago(w.backup.time)}{w.backup.success ? '' : ', vyžaduje kontrolu'}
											</span>
										{:else}<span class="text-muted">zatím žádná</span>{/if}
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
				{#if wp.checkedAt}<p class="border-t border-line px-4 py-2.5 text-xs text-muted">Čekající aktualizace podle kontroly {ago(wp.checkedAt)}.</p>{/if}
			{:else}
				<Empty title="Zatím žádný WordPress">Nové instalace z <a class="underline" href="/admin/weby">Weby a aplikace</a> se do plánu zařadí samy.</Empty>
			{/if}
		</Panel>
	</div>

	<Panel title="Výsledky poslední údržby" class="mt-5" flush>
		{#if wp.logs}
			<pre class="mono max-h-96 overflow-auto p-4 text-[11px] leading-relaxed whitespace-pre">{wp.logs}</pre>
		{:else}
			<Empty title="Údržba zatím neběžela" />
		{/if}
	</Panel>
{/if}
