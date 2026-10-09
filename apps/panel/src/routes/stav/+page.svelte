<script lang="ts">
	import type { ComponentState, Overall, StatusDay } from '#lib/server/status.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const status = $derived(data.status);

	const overallText: Record<Overall, string> = {
		ok: 'Vše běží',
		partial: 'Částečný výpadek',
		outage: 'Výpadek',
		unknown: 'Stav teď neumíme změřit',
		pending: 'Měření se teprve spouští'
	};
	const overallLed: Record<Overall, string> = {
		ok: 'bg-led',
		partial: 'bg-amber',
		outage: 'bg-[#ef4444]',
		unknown: 'bg-white/25',
		pending: 'bg-white/25'
	};
	const stateText: Record<ComponentState, string> = {
		ok: 'V provozu',
		degraded: 'Omezení',
		down: 'Nedostupné',
		unknown: 'Bez dat'
	};
	const stateTone: Record<ComponentState, string> = {
		ok: 'bg-ok-bg text-ok',
		degraded: 'bg-warn-bg text-warn',
		down: 'bg-bad-bg text-bad',
		unknown: 'bg-surface-2 text-muted'
	};
	const stateLed: Record<ComponentState, string> = {
		ok: 'bg-led',
		degraded: 'bg-amber',
		down: 'bg-[#ef4444]',
		unknown: 'bg-white/20'
	};

	const pct = new Intl.NumberFormat('cs-CZ', { maximumFractionDigits: 2, minimumFractionDigits: 0 });
	const dayFmt = new Intl.DateTimeFormat('cs-CZ', { day: 'numeric', month: 'long', timeZone: 'UTC' });
	const timeFmt = new Intl.DateTimeFormat('cs-CZ', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Prague' });
	const dayLabel = (iso: string) => dayFmt.format(new Date(iso + 'T00:00:00Z'));
	const percent = (n: number) => `${pct.format(n)} %`;

	function barClass(d: StatusDay) {
		if (d.uptime === null) return 'bg-line';
		if (d.uptime >= 99.9) return 'bg-led';
		if (d.uptime >= 99) return 'bg-amber';
		return 'bg-[#ef4444]';
	}
	const tipFor = (d: StatusDay) => `${dayLabel(d.date)}: ${d.uptime === null ? 'bez měření' : percent(d.uptime)}`;

	// hovered bar per component, shown in the line under the bars
	let tips = $state<Record<string, string>>({});
</script>

<svelte:head>
	<title>Stav služeb · SERVEROS</title>
	<meta name="description" content="Aktuální dostupnost služeb SERVEROS a historie za posledních 90 dní." />
</svelte:head>

<div class="min-h-dvh bg-bg">
	<!-- The rack face from the login screen: one unit per component, its LED is the live state. -->
	<header class="bg-chassis-3 text-white">
		<div class="mx-auto max-w-[960px] px-4 pt-6 pb-10 sm:px-6">
			<div class="flex items-center justify-between gap-4">
				<a href="https://serveros.cz" class="text-[20px] font-extrabold tracking-[0.12em]" style="font-variation-settings: 'wdth' 125">SERVEROS</a>
				<span class="mono text-xs text-white/50">stav služeb</span>
			</div>

			<div class="mt-8 flex flex-col gap-2" aria-hidden="true">
				{#each status.enabled ? status.components : [{ id: 'a', name: '', state: 'unknown' as const }, { id: 'b', name: '', state: 'unknown' as const }, { id: 'c', name: '', state: 'unknown' as const }] as c, i (c.id)}
					<div class="flex h-10 items-center gap-3 rounded-[4px] bg-chassis px-3 sm:px-4">
						<span class="mono w-6 text-[10px] text-white/30">{String(i + 1).padStart(2, '0')}</span>
						<span class="min-w-0 flex-1 truncate text-xs text-white/60">{c.name}</span>
						<span class="hidden gap-1.5 sm:flex">
							{#each Array(6) as _, j (j)}<span class="h-5 w-3 rounded-[2px] bg-chassis-2"></span>{/each}
						</span>
						<span class="size-2 rounded-full {stateLed[c.state]}"></span>
					</div>
				{/each}
			</div>

			<div class="mt-8 flex flex-wrap items-end justify-between gap-4">
				<div>
					<p
						class="mono inline-flex items-center gap-2.5 rounded-[3px] bg-[#140f06] px-3 py-2 text-[13px] text-amber shadow-[inset_0_0_0_1px_#000]"
						style="text-shadow: 0 0 6px rgba(255,180,59,.6)"
					>
						<span class="size-2 rounded-full {overallLed[status.overall]}"></span>
						{status.overall === 'ok' ? 'online, vše v pořádku' : status.overall === 'pending' ? 'čekám na první data' : status.overall === 'unknown' ? 'měření nedostupné' : 'podrobnosti níže'}
					</p>
					<h1 class="mt-4 text-[34px] leading-none font-extrabold tracking-[-0.02em] sm:text-[48px]" style="font-variation-settings: 'wdth' 112">
						{overallText[status.overall]}
					</h1>
				</div>
				{#if status.enabled}
					<p class="text-xs text-white/50">Aktualizováno v {timeFmt.format(new Date(status.generatedAt))}, obnovujeme každou minutu.</p>
				{/if}
			</div>
		</div>
	</header>

	<main class="mx-auto flex max-w-[960px] flex-col gap-4 px-4 py-8 sm:px-6">
		{#if !status.enabled}
			<section class="rounded-[6px] border border-line bg-surface p-6">
				<h2 class="text-base font-bold">Co tu brzy uvidíte</h2>
				<p class="mt-2 max-w-[60ch] text-muted">
					Dohled nad weby a servery nasazujeme. Jakmile poběží, uvidíte tu dostupnost každé části služby a historii za
					posledních 90 dní. Když něco nefunguje teď, napište na
					<a class="underline" href="mailto:info@serveros.cz">info@serveros.cz</a> nebo volejte
					<a class="underline" href="tel:+420773559645">+420 773 559 645</a>.
				</p>
			</section>
		{:else}
			{#each status.components as c (c.id)}
				{@const measured = c.days.filter((d) => d.uptime !== null).length}
				<section class="rounded-[6px] border border-line bg-surface p-4 sm:p-5" aria-labelledby="c-{c.id}">
					<div class="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
						<div>
							<h2 id="c-{c.id}" class="text-base font-bold">{c.name}</h2>
							<p class="text-sm text-muted">{c.note}</p>
						</div>
						<div class="flex items-center gap-3">
							{#if c.uptime90 !== null}
								<span class="text-sm text-muted tabular-nums">{percent(c.uptime90)} za {measured === 90 ? '90 dní' : `${measured} ${measured === 1 ? 'den' : measured < 5 ? 'dny' : 'dní'} měření`}</span>
							{/if}
							<span class="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap {stateTone[c.state]}">
								<span class="size-1.5 rounded-full {c.state === 'unknown' ? 'bg-muted' : stateLed[c.state]}"></span>
								{stateText[c.state]}{#if c.state === 'degraded' && c.current !== null}, {percent(c.current)}{/if}
							</span>
						</div>
					</div>
					<!-- svelte-ignore a11y_no_static_element_interactions -->
					<div
						class="mt-4 grid h-10 grid-cols-[repeat(90,minmax(0,1fr))] gap-px sm:gap-[3px]"
						role="img"
						aria-label="Dostupnost za 90 dní: {c.uptime90 === null ? 'zatím bez měření' : `průměr ${percent(c.uptime90)}`}"
						onpointerleave={() => (tips[c.id] = '')}
					>
						{#each c.days as d (d.date)}
							<span
								class="rounded-[2px] transition-transform hover:scale-y-110 {barClass(d)}"
								title={tipFor(d)}
								onpointerenter={() => (tips[c.id] = tipFor(d))}
							></span>
						{/each}
					</div>
					<div class="mt-2 flex justify-between gap-3 text-xs text-muted">
						<span>před 90 dny</span>
						<span class="font-semibold text-ink" aria-hidden="true">{tips[c.id] || ' '}</span>
						<span>dnes</span>
					</div>
				</section>
			{/each}

			<section class="rounded-[6px] border border-line bg-surface p-4 sm:p-5" aria-labelledby="inc-h">
				<h2 id="inc-h" class="text-base font-bold">Dny pod 99,9 %</h2>
				{#if status.incidents.length}
					<ul class="mt-3 divide-y divide-line">
						{#each status.incidents.slice(0, 20) as inc (inc.date + inc.component)}
							<li class="flex flex-wrap justify-between gap-x-4 gap-y-1 py-2 text-sm">
								<span><span class="font-semibold">{dayLabel(inc.date)}</span> · {inc.component}</span>
								<span class="text-muted tabular-nums">{percent(inc.uptime)} dostupnost</span>
							</li>
						{/each}
					</ul>
				{:else}
					<p class="mt-2 text-sm text-muted">Za sledované období žádný den pod 99,9 %.</p>
				{/if}
			</section>
		{/if}

		{#if status.enabled}
		<p class="flex flex-wrap items-center gap-x-5 gap-y-1 pt-2 text-xs text-muted">
			<span class="flex items-center gap-2"><span class="size-2 rounded-[2px] bg-led"></span>aspoň 99,9 %</span>
			<span class="flex items-center gap-2"><span class="size-2 rounded-[2px] bg-amber"></span>99 až 99,9 %</span>
			<span class="flex items-center gap-2"><span class="size-2 rounded-[2px] bg-[#ef4444]"></span>pod 99 %</span>
			<span class="flex items-center gap-2"><span class="size-2 rounded-[2px] bg-line"></span>bez měření</span>
		</p>
		{/if}
	</main>

	<footer class="mx-auto flex max-w-[960px] flex-wrap justify-between gap-3 border-t border-line px-4 py-6 text-xs text-muted sm:px-6">
		<span>{status.enabled ? 'Měříme každou minutu z našeho monitoringu. ' : ''}Ukazujeme jen souhrnná čísla, žádné weby ani zákazníky jednotlivě.</span>
		<span class="flex gap-4">
			<a class="underline" href="https://serveros.cz">serveros.cz</a>
			<a class="underline" href="mailto:info@serveros.cz">info@serveros.cz</a>
		</span>
	</footer>
</div>
