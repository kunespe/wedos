<script lang="ts">
	import { enhance } from '$app/forms';
	import { Check, CircleCheck, Search, X } from '@lucide/svelte';
	import Button from '#lib/components/Button.svelte';
	import Field from '#lib/components/Field.svelte';
	import FormMessage from '#lib/components/FormMessage.svelte';
	import PageHeader from '#lib/components/PageHeader.svelte';
	import Panel from '#lib/components/Panel.svelte';
	import Pill from '#lib/components/Pill.svelte';
	import ServiceKind from '#lib/components/ServiceKind.svelte';
	import { ago, czk, dateTime, periodTotal, YEARLY_MONTHS } from '#lib/format.ts';
	import { keepResult } from '#lib/forms.ts';
	import { BASKET_MODE_LABEL, basketTotal, domainPrice, MAX_BASKET, priced, yearsLabel, type BasketItem, type BasketMode } from '#lib/domains.ts';
	import { NON_HOSTING_CATEGORIES, ORDER_STATUS_LABEL, PLAN_CATEGORY_LABEL } from '#lib/orders.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	// svelte-ignore state_referenced_locally
	let plan = $state(data.preselected ?? '');
	let period = $state<'month' | 'year'>('year');
	let domainMode = $state<'own' | 'register' | 'none'>('own');
	let busy = $state(false);

	const errors = $derived<Record<string, string>>(form && 'errors' in form ? (form.errors ?? {}) : {});
	// The "domains only" plan is not a hosting tariff: it is offered only while the basket has something in it.
	const domainOnlyPlan = $derived(data.plans.find((p) => NON_HOSTING_CATEGORIES.includes(p.category)));
	const domainOnly = $derived(!!domainOnlyPlan && plan === domainOnlyPlan.code);
	const groups = $derived.by(() => {
		const order = Object.keys(PLAN_CATEGORY_LABEL);
		const map = new Map<string, typeof data.plans>();
		for (const p of data.plans) if (!NON_HOSTING_CATEGORIES.includes(p.category)) map.set(p.category, [...(map.get(p.category) ?? []), p]);
		return [...map.entries()].sort(([a], [b]) => (order.indexOf(a) + 1 || 99) - (order.indexOf(b) + 1 || 99));
	});
	const chosen = $derived(data.plans.find((p) => p.code === plan));
	const priceOf = (monthly: number | null, priceFrom: boolean) =>
		monthly == null ? 'Individuálně' : `${priceFrom ? 'od ' : ''}${czk(periodTotal(monthly, period))}`;
	const err = (k: string) => (errors[k] ? { 'aria-invalid': 'true' as const, 'aria-describedby': `f-${k}-error` } : {});
	const domainModes = [
		{ value: 'own', label: 'Mám vlastní doménu', hint: 'Nasměrujeme ji, nebo vám pošleme, co nastavit.' },
		{ value: 'register', label: 'Zaregistrovat novou', hint: 'Zaregistrujeme ji za vás, cenu doplníme na fakturu.' },
		{ value: 'none', label: 'Bez domény', hint: 'Například VPS nebo správa serveru.' }
	] as const;

	/* ---------- Domain basket: search through /app/objednat/dostupnost, the same RDAP check as the storefront ---------- */
	type DomainResult = { name: string; available: boolean | null; reason?: string; price: number | null; invalid?: boolean };
	let basket = $state<BasketItem[]>([]);
	let query = $state('');
	let results = $state<DomainResult[]>([]);
	let searching = $state(false);
	let searchError = $state('');
	let searchSeq = 0;
	let debounce: ReturnType<typeof setTimeout> | undefined;
	const basketPriced = $derived(priced(basket));
	const total = $derived(basketTotal(basketPriced));
	const inBasket = (name: string) => basket.find((d) => d.name === name);

	async function search() {
		clearTimeout(debounce);
		const q = query.trim();
		if (q.length < 2) return;
		const seq = ++searchSeq;
		searching = true;
		searchError = '';
		try {
			const res = await fetch(`/app/objednat/dostupnost?q=${encodeURIComponent(q)}`, { headers: { Accept: 'application/json' } });
			const body = (await res.json()) as { results?: DomainResult[]; error?: string };
			if (seq !== searchSeq) return; // a newer search is on its way
			results = body.results ?? [];
			searchError = body.error ?? '';
		} catch {
			if (seq === searchSeq) searchError = 'Dostupnost teď nejde ověřit. Zkuste to za chvíli.';
		} finally {
			if (seq === searchSeq) searching = false;
		}
	}
	function onQuery() {
		clearTimeout(debounce);
		debounce = setTimeout(search, 700);
	}
	function toggle(name: string, mode: BasketMode) {
		const current = inBasket(name);
		if (current && current.mode === mode) return remove(name);
		if (current) current.mode = mode;
		else if (basket.length < MAX_BASKET) basket.push({ name, mode, years: 1 });
	}
	function remove(name: string) {
		basket = basket.filter((d) => d.name !== name);
		if (!basket.length && domainOnly) plan = '';
	}
	const statusOf = (r: DomainResult) =>
		r.invalid
			? { tone: 'bad' as const, label: 'neplatná' }
			: r.available === true
				? { tone: 'ok' as const, label: 'volná' }
				: r.available === false
					? { tone: 'bad' as const, label: 'obsazená' }
					: { tone: 'warn' as const, label: 'ověříme ručně' };
</script>

<PageHeader title="Objednat">
	{#snippet meta()}Další služba na váš účet. Zřídí ji člověk, obvykle do 4 pracovních hodin. Ceny jsou bez DPH.{/snippet}
</PageHeader>

{#if form && 'ordered' in form && form.ordered}
	<div class="mx-auto max-w-2xl">
		<Panel>
			<div class="flex flex-col items-center gap-3 px-2 py-6 text-center">
				<CircleCheck size={36} class="text-ok" />
				<h2 class="text-lg font-extrabold">Objednávka č. {form.ordered.id} je u nás</h2>
				<p class="max-w-md text-sm text-muted">
					{form.ordered.plan}{form.ordered.domain ? ` pro ${form.ordered.domain}` : ''}, {form.ordered.price}.
					{#if form.ordered.domains.length}Domény: {form.ordered.domains.join(', ')}.{/if}
					Ozveme se v pracovní době, vše zřídíme ručně a stav uvidíte v klientské zóně.
				</p>
				<div class="mt-2 flex flex-wrap justify-center gap-2">
					<Button href="/app/sluzby" variant="primary">Moje služby</Button>
					<Button href="/app/objednat" data-sveltekit-reload>Objednat další</Button>
				</div>
			</div>
		</Panel>
	</div>
{:else}
	<FormMessage form={form && 'error' in form ? form : null} />
	<form
		method="POST"
		class="grid gap-5 xl:grid-cols-[1fr_320px]"
		use:enhance={(input) => {
			busy = true;
			return keepResult({ onDone: () => (busy = false) })(input);
		}}
	>
		<div class="flex min-w-0 flex-col gap-5">
			<fieldset class="min-w-0">
				<legend class="mb-2 flex w-full flex-wrap items-center justify-between gap-2">
					<span class="text-sm font-bold">1. Tarif</span>
					<span class="inline-flex rounded-[6px] border border-line bg-surface p-0.5 text-xs font-semibold" role="radiogroup" aria-label="Období platby">
						{#each [{ v: 'year', l: `Ročně (${12 - YEARLY_MONTHS} měsíce zdarma)` }, { v: 'month', l: 'Měsíčně' }] as o (o.v)}
							<label class="cursor-pointer rounded-[4px] px-2.5 py-1 {period === o.v ? 'bg-accent text-accent-ink' : 'text-muted hover:text-ink'}">
								<input type="radio" name="period" value={o.v} bind:group={period} class="sr-only" />{o.l}
							</label>
						{/each}
					</span>
				</legend>
				{#if errors.plan}<p id="f-plan-error" class="mb-2 text-xs font-medium text-bad">{errors.plan}</p>{/if}
				<div class="flex flex-col gap-4">
					{#each groups as [category, list] (category)}
						<section aria-label={PLAN_CATEGORY_LABEL[category] ?? category}>
							<h3 class="mb-1.5 text-xs font-semibold text-muted">{PLAN_CATEGORY_LABEL[category] ?? category}</h3>
							<div class="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
								{#each list as p (p.code)}
									<label
										class="flex min-w-0 cursor-pointer flex-col rounded-[6px] border bg-surface p-4 transition-colors hover:bg-surface-2 {plan === p.code
											? 'border-accent ring-2 ring-accent/25'
											: 'border-line'}"
									>
										<span class="flex items-start justify-between gap-2">
											<span class="min-w-0">
												<span class="block font-bold">{p.name}</span>
												<span class="block text-xs text-muted"><ServiceKind kind={p.kind} size={12} /></span>
											</span>
											<input type="radio" name="plan" value={p.code} bind:group={plan} class="mt-1 size-4 shrink-0 accent-[var(--accent)]" {...err('plan')} />
										</span>
										<span class="mt-2 block">
											<span class="mono text-base font-semibold">{priceOf(p.monthly, p.priceFrom)}</span>
											{#if p.monthly != null}<span class="text-xs text-muted"> / {period === 'year' ? 'rok' : 'měsíc'}</span>{/if}
										</span>
										{#if p.features.length}
											<ul class="mt-2 flex flex-col gap-1 border-t border-line pt-2 text-xs text-muted">
												{#each p.features.slice(0, 4) as f (f)}<li class="flex items-start gap-1.5"><Check size={13} class="mt-px shrink-0 text-ok" />{f}</li>{/each}
											</ul>
										{/if}
									</label>
								{/each}
							</div>
						</section>
					{/each}
					{#if domainOnlyPlan && basket.length}
						<section aria-label="Bez hostingu">
							<h3 class="mb-1.5 text-xs font-semibold text-muted">Bez hostingu</h3>
							<div class="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
								<label
									class="flex min-w-0 cursor-pointer flex-col rounded-[6px] border bg-surface p-4 transition-colors hover:bg-surface-2 {domainOnly
										? 'border-accent ring-2 ring-accent/25'
										: 'border-line'}"
								>
									<span class="flex items-start justify-between gap-2">
										<span class="min-w-0">
											<span class="block font-bold">Jen domény</span>
											<span class="block text-xs text-muted">{domainOnlyPlan.name}, bez hostingu</span>
										</span>
										<input type="radio" name="plan" value={domainOnlyPlan.code} bind:group={plan} class="mt-1 size-4 shrink-0 accent-[var(--accent)]" {...err('plan')} />
									</span>
									<span class="mt-2 block text-xs text-muted">Platíte jen domény v košíku, {basket.length}× {basket.length === 1 ? 'doména' : 'domény'}.</span>
								</label>
							</div>
						</section>
					{/if}
				</div>
			</fieldset>

			{#if domainOnly}
				<input type="hidden" name="domainMode" value="none" />
			{:else}
				<Panel title="2. Doména">
					<fieldset class="grid gap-2 sm:grid-cols-3">
						<legend class="sr-only">Doména</legend>
						{#each domainModes as m (m.value)}
							<label class="flex cursor-pointer items-start gap-2 rounded-[6px] border p-3 text-sm {domainMode === m.value ? 'border-accent bg-info-bg' : 'border-line'}">
								<input type="radio" name="domainMode" value={m.value} bind:group={domainMode} class="mt-0.5 size-4 shrink-0 accent-[var(--accent)]" />
								<span class="min-w-0"><span class="block font-semibold">{m.label}</span><span class="block text-xs text-muted">{m.hint}</span></span>
							</label>
						{/each}
					</fieldset>
					{#if domainMode !== 'none'}
						<Field label={domainMode === 'register' ? 'Doména k registraci' : 'Vaše doména'} id="f-domain" error={errors.domain} class="mt-4 max-w-sm">
							<input class="input mono" id="f-domain" name="domain" placeholder="firma.cz" autocomplete="off" required {...err('domain')} />
						</Field>
					{/if}
				</Panel>
			{/if}

			<Panel title="3. Registrace a převod domén">
				<p class="mb-3 text-sm text-muted">Další domény k objednávce, i bez hostingu. Volnou zaregistrujeme, obsazenou vaši k nám převedeme.</p>
				<div class="flex max-w-xl gap-2">
					<label class="sr-only" for="f-search">Hledat doménu</label>
					<input
						class="input mono min-w-0 flex-1"
						id="f-search"
						type="text"
						inputmode="url"
						autocomplete="off"
						spellcheck="false"
						maxlength="253"
						placeholder="firma nebo firma.cz"
						bind:value={query}
						oninput={onQuery}
						onkeydown={(e) => {
							if (e.key === 'Enter') {
								e.preventDefault();
								search();
							}
						}}
					/>
					<Button onclick={search} disabled={searching || query.trim().length < 2}><Search size={14} /> {searching ? 'Ověřuji' : 'Ověřit'}</Button>
				</div>
				{#if searchError}<p class="mt-2 text-xs font-medium text-bad" role="alert">{searchError}</p>{/if}
				{#if results.length}
					<ul class="mt-3 overflow-hidden rounded-[6px] border border-line" aria-live="polite" aria-busy={searching}>
						{#each results as r (r.name)}
							{@const st = statusOf(r)}
							{@const item = inBasket(r.name)}
							<li class="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-line px-3 py-2.5 text-sm last:border-b-0">
								<span class="mono min-w-0 flex-1 font-semibold break-all">{r.name}</span>
								<span title={r.reason ?? ''}><Pill tone={st.tone}>{st.label}</Pill></span>
								<span class="mono w-28 text-right text-xs text-muted">{r.price == null ? 'cenu potvrdíme' : `${czk(r.price)} / rok`}</span>
								{#if r.available === false}
									<Button size="sm" variant={item?.mode === 'transfer' ? 'primary' : 'secondary'} aria-pressed={item?.mode === 'transfer'} onclick={() => toggle(r.name, 'transfer')}>
										{item?.mode === 'transfer' ? 'Převod v košíku' : 'Převést k nám'}
									</Button>
								{:else if r.invalid}
									<span class="text-xs text-muted">{r.reason}</span>
								{:else}
									<Button size="sm" variant={item?.mode === 'register' ? 'primary' : 'secondary'} aria-pressed={item?.mode === 'register'} onclick={() => toggle(r.name, 'register')}>
										{item?.mode === 'register' ? 'V košíku' : 'Do košíku'}
									</Button>
								{/if}
							</li>
						{/each}
					</ul>
				{/if}

				<input type="hidden" name="domains" value={JSON.stringify(basket)} />
				{#if errors.domains}<p class="mt-3 text-xs font-medium text-bad">{errors.domains}</p>{/if}
				{#if basket.length}
					<h3 class="mt-5 mb-1.5 text-xs font-semibold text-muted">Košík domén ({basket.length})</h3>
					<ul class="overflow-hidden rounded-[6px] border border-line">
						{#each basket as d (d.name)}
							{@const price = domainPrice(d.name)}
							<li class="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line px-3 py-2.5 text-sm last:border-b-0">
								<span class="mono min-w-0 flex-1 font-semibold break-all">{d.name}</span>
								<label class="sr-only" for="mode-{d.name}">Režim pro {d.name}</label>
								<select id="mode-{d.name}" class="input w-auto py-1 text-xs" bind:value={d.mode}>
									{#each Object.entries(BASKET_MODE_LABEL) as [v, l] (v)}<option value={v}>{l}</option>{/each}
								</select>
								<label class="sr-only" for="years-{d.name}">Počet let pro {d.name}</label>
								<select id="years-{d.name}" class="input w-auto py-1 text-xs" bind:value={d.years}>
									{#each [1, 2, 3] as y (y)}<option value={y}>{yearsLabel(y)}</option>{/each}
								</select>
								<span class="mono w-28 text-right text-xs">{price == null ? 'cenu potvrdíme' : czk(price * d.years)}</span>
								<Button size="sm" variant="ghost" aria-label="Odebrat {d.name}" onclick={() => remove(d.name)}><X size={14} /></Button>
							</li>
						{/each}
					</ul>
				{/if}
			</Panel>

			<Panel title="4. Poznámka">
				<Field label="Poznámka pro technika (nepovinné)" id="f-note" error={errors.note} hint="Například stěhování ze stávajícího hostingu nebo termín spuštění.">
					<textarea class="input" id="f-note" name="note" maxlength="2000" {...err('note')}></textarea>
				</Field>
			</Panel>
		</div>

		<div class="flex min-w-0 flex-col gap-5 xl:sticky xl:top-5 xl:self-start">
			<Panel title="Shrnutí">
				{#if domainOnly}
					<div class="font-bold">Jen domény</div>
					<p class="mt-1 text-xs text-muted">Bez hostingu. Domény z košíku níže.</p>
				{:else if chosen}
					<div class="font-bold">{chosen.name}</div>
					<div class="mt-1 flex items-baseline justify-between gap-2 text-sm">
						<span class="text-muted">{period === 'year' ? 'Platba ročně' : 'Platba měsíčně'}</span>
						<span class="mono font-semibold">{priceOf(chosen.monthly, chosen.priceFrom)}</span>
					</div>
					<p class="mt-1 text-xs text-muted">{chosen.monthly == null ? 'Cenu domluvíme podle rozsahu.' : 'Bez DPH. Fakturu pošleme po zřízení.'}</p>
				{:else}
					<p class="text-sm text-muted">Vyberte tarif vlevo.</p>
				{/if}
				{#if basket.length}
					<ul class="mt-3 flex flex-col gap-1 border-t border-line pt-3 text-sm">
						{#each basketPriced as d (d.name)}
							<li class="flex items-baseline justify-between gap-2">
								<span class="min-w-0 break-all"><span class="mono">{d.name}</span> <span class="block text-xs text-muted">{BASKET_MODE_LABEL[d.mode].toLowerCase()}, {yearsLabel(d.years)}</span></span>
								<span class="mono text-xs whitespace-nowrap">{d.price == null ? 'potvrdíme' : czk(d.price * d.years)}</span>
							</li>
						{/each}
						<li class="mt-1 flex items-baseline justify-between gap-2 border-t border-line pt-2 font-semibold">
							<span>Domény bez DPH</span><span class="mono">{czk(total.known)}</span>
						</li>
					</ul>
					{#if total.unknown}<p class="mt-1 text-xs text-muted">Cenu ostatních koncovek potvrdíme e-mailem, než doménu objednáme.</p>{/if}
				{/if}
				<Button type="submit" variant="primary" class="mt-4 w-full" disabled={busy || !chosen || (domainOnly && !basket.length)}>{busy ? 'Odesílám' : 'Závazně objednat'}</Button>
				<p class="mt-2 text-xs text-muted">Nic se nespustí automaticky. Před zřízením se vám ozveme, když bude potřeba cokoli upřesnit.</p>
			</Panel>

			{#if data.customer}
				<Panel title="Objednáváte na účet">
					<dl class="grid grid-cols-[70px_1fr] gap-x-3 gap-y-1 text-sm">
						<dt class="text-muted">Jméno</dt>
						<dd class="min-w-0 break-words">{data.customer.company || data.customer.name}</dd>
						{#if data.customer.ico}<dt class="text-muted">IČO</dt><dd class="mono text-xs">{data.customer.ico}</dd>{/if}
						<dt class="text-muted">E-mail</dt>
						<dd class="min-w-0 break-all">{data.customer.email}</dd>
					</dl>
					<p class="mt-2 text-xs text-muted">Fakturační údaje změníte v sekci <a class="underline" href="/app/ucet">Účet</a>.</p>
				</Panel>
			{/if}

			{#if data.open.length}
				<Panel title="Rozpracované objednávky" flush>
					<ul class="text-sm">
						{#each data.open as o (o.id)}
							<li class="flex items-center gap-3 border-b border-line px-4 py-2.5 last:border-b-0">
								<span class="min-w-0 flex-1">
									<span class="block truncate font-semibold">{o.plan ?? 'Tarif'}{o.domain ? ` · ${o.domain}` : ''}</span>
									<span class="block text-xs text-muted" title={dateTime(o.createdAt)}>č. {o.id}, {ago(o.createdAt)}</span>
								</span>
								<Pill tone="act">{ORDER_STATUS_LABEL[o.status]}</Pill>
							</li>
						{/each}
					</ul>
				</Panel>
			{/if}
		</div>
	</form>
{/if}
