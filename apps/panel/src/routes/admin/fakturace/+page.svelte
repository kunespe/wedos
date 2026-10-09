<script lang="ts">
	import { enhance } from '$app/forms';
	import { keepResult } from '#lib/forms.ts';
	import { RefreshCw, ShieldAlert } from '@lucide/svelte';
	import BrandIcon from '#lib/components/BrandIcon.svelte';
	import BrokerDown from '#lib/components/BrokerDown.svelte';
	import Button from '#lib/components/Button.svelte';
	import Empty from '#lib/components/Empty.svelte';
	import FormMessage from '#lib/components/FormMessage.svelte';
	import Led from '#lib/components/Led.svelte';
	import PageHeader from '#lib/components/PageHeader.svelte';
	import Panel from '#lib/components/Panel.svelte';
	import Pill from '#lib/components/Pill.svelte';
	import { ago, date, dateTime, SERVICE_STATUS_LABEL } from '#lib/format.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const b = $derived(data.billing);
	let syncing = $state(false);
	let editing = $state<string | null>(null);

	const ACTION: Record<string, { label: string; tone: 'ok' | 'act' | 'warn' | 'bad' | 'off' }> = {
		keep: { label: 'Ponechat', tone: 'ok' },
		suspend: { label: 'Navrženo pozastavit', tone: 'bad' },
		resume: { label: 'Navrženo obnovit', tone: 'act' },
		unknown: { label: 'Neznámé předplatné', tone: 'warn' }
	};
	const unlinked = $derived(b ? b.subscriptions.filter((x) => !x.services.length && !x.sites.length).length : 0);
	const proposals = $derived(b ? b.sites.filter((x) => x.action) : []);
	const flagged = $derived(proposals.filter((x) => x.action === 'suspend' || x.action === 'resume' || x.action === 'unknown').length);
</script>

<PageHeader title="Fakturace">
	{#snippet meta()}<span><BrandIcon name="fakturor" class="mr-1" />Fakturor řeší doklady, platby a prodloužení. Panel z něj čte platnost předplatných.</span>{/snippet}
	{#snippet actions()}
		{#if b}
			<form
				method="POST"
				action="?/sync"
				use:enhance={(input) => {
					syncing = true;
					return keepResult({ onDone: () => (syncing = false) })(input);
				}}
			>
				<Button type="submit" size="sm" variant="primary" disabled={syncing || !b.config.api_configured}>
					<RefreshCw size={14} class={syncing ? 'animate-spin' : ''} />
					{syncing ? 'Synchronizuji' : 'Synchronizovat s Fakturorem'}
				</Button>
			</form>
		{/if}
	{/snippet}
</PageHeader>

<FormMessage {form} />

{#if !b}
	<BrokerDown error={data.error} enabled={data.enabled} />
{:else}
	<div class="mb-5 flex gap-3 rounded-[6px] border border-line bg-surface-2 p-4 text-sm">
		<ShieldAlert size={18} class="mt-0.5 shrink-0 text-muted" />
		<p>
			<span class="font-bold">Pozastavení za neplacení nikdy neproběhne samo.</span>
			Synchronizace jen navrhuje akci. Web vypíná vždy člověk v sekci <a class="underline" href="/admin/weby">Weby a aplikace</a>, po kontrole
			ve Fakturoru. Rozhoduje platnost předplatného, ne splatnost jednotlivé faktury.
		</p>
	</div>

	{#if b.syncError}
		<div role="alert" class="mb-5 rounded-[6px] border border-bad/30 bg-bad-bg px-3 py-2 text-sm font-medium text-bad">{b.syncError}</div>
	{/if}

	<div class="grid grid-cols-2 gap-3 lg:grid-cols-5">
		{#each [
			{ label: 'API klíč', on: b.config.api_configured, yes: 'Nastavený', no: 'Chybí' },
			{ label: 'Vyhodnocování', on: b.config.enabled, yes: 'Zapnuté', no: 'Vypnuté' },
			{ label: 'Režim', on: b.config.dry_run, yes: 'Jen sledování', no: 'Ostrý' }
		] as card (card.label)}
			<div class="rounded-[6px] border border-line bg-surface px-4 py-3">
				<div class="text-xs font-semibold text-muted">{card.label}</div>
				<div class="mt-1.5 flex items-center gap-2 font-semibold">
					<Led state={card.on ? 'ok' : 'off'} />{card.on ? card.yes : card.no}
				</div>
			</div>
		{/each}
		<div class="rounded-[6px] border border-line bg-surface px-4 py-3">
			<div class="text-xs font-semibold text-muted">Ochranná lhůta</div>
			<div class="mono mt-1 text-[20px] leading-none font-medium">{b.config.grace_days} dní</div>
			<div class="mt-1 text-xs text-muted">po posledním platném dni</div>
		</div>
		<div class="col-span-2 rounded-[6px] border border-line bg-surface px-4 py-3 lg:col-span-1">
			<div class="text-xs font-semibold text-muted">Poslední úspěšná kontrola</div>
			<div class="mt-1.5 font-semibold" title={b.checkedAt ? dateTime(b.checkedAt) : undefined}>{b.checkedAt ? ago(b.checkedAt) : 'Dosud neproběhla'}</div>
			<div class="mt-1 text-xs text-muted">automaticky každých 10 minut</div>
		</div>
	</div>

	<Panel title="Návrhy podle platnosti" class="mt-5" flush>
		{#snippet actions()}
			{#if flagged}<Pill tone="warn">{flagged} k posouzení</Pill>{/if}
		{/snippet}
		{#if proposals.length}
			<div class="overflow-x-auto">
				<table class="w-full text-sm">
					<thead>
						<tr class="bg-surface-2 text-left text-xs text-muted">
							<th class="h-9 px-4 font-semibold">Web</th>
							<th class="h-9 px-4 font-semibold">Předplatné</th>
							<th class="h-9 px-4 font-semibold">Platí do</th>
							<th class="h-9 px-4 font-semibold">Návrh</th>
							<th class="h-9 px-4 font-semibold">Důvod</th>
						</tr>
					</thead>
					<tbody>
						{#each proposals as p (p.domain)}
							{@const a = ACTION[p.action ?? ''] ?? { label: p.action ?? '', tone: 'off' as const }}
							<tr class="border-t border-line {p.action === 'suspend' ? 'bg-bad-bg/40' : ''}">
								<td class="px-4 py-2 font-semibold whitespace-nowrap">{p.domain}</td>
								<td class="min-w-52 px-4 py-2">
									{#if p.subscription}<span class="mono text-xs text-muted">#{p.subscription.id}</span> {p.subscription.name}{:else}<span class="mono text-xs">#{p.subscriptionId}</span>{/if}
								</td>
								<td class="px-4 py-2 text-xs whitespace-nowrap">
									{#if p.subscription}
										<span class={p.subscription.is_expired ? 'font-semibold text-bad' : ''}>{date(p.subscription.expires_on)}</span>
										{#if p.subscription.is_expired && p.subscription.suspend_at}<div class="text-[11px] text-muted">lhůta do {date(p.subscription.suspend_at)}</div>{/if}
									{:else}·{/if}
								</td>
								<td class="px-4 py-2 whitespace-nowrap"><Pill tone={a.tone}>{a.label}</Pill></td>
								<td class="px-4 py-2 text-xs text-muted">{p.reason}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
			<p class="border-t border-line px-4 py-2.5 text-xs text-muted">
				„Navrženo pozastavit“ znamená jen to, že platnost vypršela a uplynula ochranná lhůta. Ruční výjimka má vždy přednost.
			</p>
		{:else}
			<Empty title="Žádné návrhy">Návrhy vznikají jen u webů propojených s předplatným ve Fakturoru.</Empty>
		{/if}
	</Panel>

	<Panel title="Předplatná ve Fakturoru" brand="fakturor" class="mt-5" flush>
		{#snippet actions()}
			{#if unlinked}<Pill tone="warn">{unlinked} nepropojených</Pill>{/if}
		{/snippet}
		{#if b.subscriptions.length}
			<div class="overflow-x-auto">
				<table class="w-full text-sm">
					<thead>
						<tr class="bg-surface-2 text-left text-xs text-muted">
							<th class="h-9 px-4 font-semibold">ID</th>
							<th class="h-9 px-4 font-semibold">Název</th>
							<th class="h-9 px-4 font-semibold">Platí do</th>
							<th class="h-9 px-4 font-semibold">Služby v panelu</th>
							<th class="h-9 px-4 font-semibold">Web v CloudPanelu</th>
						</tr>
					</thead>
					<tbody>
						{#each b.subscriptions as sub (sub.id)}
							{@const lonely = !sub.services.length && !sub.sites.length}
							<tr class="border-t border-line {lonely ? 'bg-warn-bg' : ''}">
								<td class="mono px-4 py-2 text-xs">#{sub.id}</td>
								<td class="min-w-52 px-4 py-2">
									<span class="font-semibold">{sub.name}</span>
									{#if !sub.active}<Pill tone="off">neaktivní</Pill>{/if}
									{#if lonely}<div class="text-xs font-semibold text-warn">Nepropojené s žádnou službou ani webem</div>{/if}
								</td>
								<td class="px-4 py-2 text-xs whitespace-nowrap {sub.is_expired ? 'font-semibold text-bad' : ''}">{date(sub.expires_on)}</td>
								<td class="px-4 py-2">
									{#each sub.services as svc (svc.id)}
										<a class="block text-xs hover:underline" href="/admin/sluzby/{svc.id}">
											{svc.label} <span class="text-muted">· {svc.company || svc.customer} · {SERVICE_STATUS_LABEL[svc.status]}</span>
										</a>
									{:else}<span class="text-xs text-muted">žádná</span>{/each}
								</td>
								<td class="mono px-4 py-2 text-xs">{sub.sites.join(', ') || '·'}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{:else}
			<Empty title="Žádná předplatná">Zatím neproběhla úspěšná synchronizace.</Empty>
		{/if}
		{#if b.orphans.length}
			<div class="border-t border-line px-4 py-3 text-sm">
				<div class="font-semibold text-bad">Služby s neznámým předplatným</div>
				<ul class="mt-1 flex flex-col gap-0.5 text-xs">
					{#each b.orphans as o (o.id)}
						<li><a class="hover:underline" href="/admin/sluzby/{o.id}">{o.label}</a> <span class="mono text-muted">#{o.subscriptionId}</span> Fakturor toto ID nevrací.</li>
					{/each}
				</ul>
			</div>
		{/if}
	</Panel>

	<Panel title="Propojení webů s předplatným" class="mt-5" flush>
		{#if b.sites.length}
			<ul>
				{#each b.sites as site (site.domain)}
					<li class="border-b border-line last:border-b-0">
						<div class="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5 text-sm">
							<span class="min-w-40 font-semibold">{site.domain}</span>
							<span class="text-muted">{site.client || 'Bez klienta'}</span>
							<span class="mono text-xs">{site.subscriptionId ? `#${site.subscriptionId}` : 'nepřiřazené'}</span>
							<span class="text-xs text-muted">{site.expiresAt ? `do ${date(site.expiresAt)}` : 'bez data'}</span>
							{#if site.manualHold}<Pill tone="off">ruční výjimka</Pill>{/if}
							<span class="ml-auto">
								<Button size="sm" variant="ghost" onclick={() => (editing = editing === site.domain ? null : site.domain)} aria-expanded={editing === site.domain}>
									{editing === site.domain ? 'Zavřít' : 'Upravit'}
								</Button>
							</span>
						</div>
						{#if editing === site.domain}
							<form
								method="POST"
								action="?/hosting"
								use:enhance={keepResult({ onDone: () => (form?.error ? null : (editing = null)) })}
								class="grid gap-3 bg-surface-2 px-4 py-3 sm:grid-cols-2 lg:grid-cols-[1fr_1.4fr_auto_auto_auto] lg:items-end"
							>
								<input type="hidden" name="domain" value={site.domain} />
								<div>
									<label class="label" for="client-{site.domain}">Klient</label>
									<input id="client-{site.domain}" name="client" class="input" maxlength="120" value={site.client} />
								</div>
								<div>
									<label class="label" for="sub-{site.domain}">Předplatné ve Fakturoru</label>
									<select id="sub-{site.domain}" name="subscription_id" class="input">
										<option value="">Nepřiřazené</option>
										{#each b.subscriptions as sub (sub.id)}
											<option value={sub.id} selected={site.subscriptionId === sub.id}>#{sub.id} · {sub.name}</option>
										{/each}
									</select>
								</div>
								<div>
									<label class="label" for="exp-{site.domain}">Poslední platný den</label>
									<input
										id="exp-{site.domain}"
										type="date"
										name="expires_at"
										class="input"
										value={site.expiresAt}
										readonly={!!site.subscriptionId}
										title={site.subscriptionId ? 'Datum se bere z Fakturoru' : undefined}
									/>
								</div>
								<label class="flex h-[34px] items-center gap-2 text-sm whitespace-nowrap">
									<input type="checkbox" name="manual_hold" checked={site.manualHold} class="size-4 accent-[var(--accent)]" />
									Ruční výjimka
								</label>
								<Button type="submit" variant="primary">Uložit</Button>
							</form>
						{/if}
					</li>
				{/each}
			</ul>
		{:else}
			<Empty title="Nejdřív založte web" />
		{/if}
	</Panel>
{/if}
