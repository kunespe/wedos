<script lang="ts">
	import { enhance } from '$app/forms';
	import { keepResult } from '#lib/forms.ts';
	import { TriangleAlert } from '@lucide/svelte';
	import BrandIcon from '#lib/components/BrandIcon.svelte';
	import BrokerDown from '#lib/components/BrokerDown.svelte';
	import Button from '#lib/components/Button.svelte';
	import DataTable from '#lib/components/DataTable.svelte';
	import Field from '#lib/components/Field.svelte';
	import FormMessage from '#lib/components/FormMessage.svelte';
	import PageHeader from '#lib/components/PageHeader.svelte';
	import Panel from '#lib/components/Panel.svelte';
	import Pill from '#lib/components/Pill.svelte';
	import SecretValue from '#lib/components/SecretValue.svelte';
	import type { Column } from '#lib/components/table.ts';
	import { siteKindBrand } from '#lib/brands.ts';
	import { date, daysUntil, SERVICE_STATUS_LABEL } from '#lib/format.ts';
	import { SITE_KIND_LABEL, SITE_KINDS } from '#lib/ops.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	type Site = NonNullable<typeof data.sites>[number];

	let confirming = $state<string | null>(null);
	let pending = $state<string | null>(null);
	let creating = $state(false);
	let kind = $state('wordpress');
	let dismissed = $state(false);
	const needsPort = $derived(kind === 'nodejs' || kind === 'bun');

	const created = $derived(form && 'created' in form ? form.created : null);
	const values = $derived(form && 'values' in form ? form.values : null);
	$effect(() => {
		created;
		dismissed = false;
	});

	const CRED_LABEL: Record<string, string> = {
		user: 'SFTP uživatel',
		sftp_password: 'SFTP heslo',
		wordpress_password: 'WordPress heslo (uživatel admin)'
	};

	const columns: Column<Site>[] = [
		{ label: 'Doména', sort: (r) => r.domain },
		{ label: 'Typ', sort: (r) => r.kind },
		{ label: 'Klient', sort: (r) => r.client },
		{ label: 'Expirace', sort: (r) => r.expiresAt || null },
		{ label: 'Služba v panelu' },
		{ label: 'Provoz', sort: (r) => (r.suspended ? 1 : 0) },
		{ label: '', class: 'w-0' }
	];
</script>

<PageHeader title="Weby a aplikace">
	{#snippet meta()}Weby v CloudPanelu na uzlu vytvorit-web. Založení tady i v CloudPanelu pracuje se stejným seznamem.{/snippet}
</PageHeader>

<FormMessage {form} />

{#if created && !dismissed}
	<section class="mb-5 rounded-[6px] border border-warn/40 bg-warn-bg p-4" aria-labelledby="cred-title">
		<div class="flex items-start gap-2.5">
			<TriangleAlert size={18} class="mt-0.5 shrink-0 text-warn" />
			<div class="min-w-0 flex-1">
				<h2 id="cred-title" class="text-sm font-bold">Přístupy k webu {created.domain}</h2>
				<p class="mt-0.5 text-sm text-warn">
					Uložte je hned do správce hesel. Zobrazují se jen teď; po opuštění stránky je už nikde neuvidíte a panel je neukládá.
				</p>
			</div>
		</div>
		<div class="mt-3 grid gap-3 md:grid-cols-2">
			{#each Object.entries(created.credentials) as [key, value] (key)}
				{#if value}<SecretValue label={CRED_LABEL[key] ?? key} value={String(value)} />{/if}
			{/each}
		</div>
		<div class="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
			<span>
				{#if created.kind === 'nodejs' || created.kind === 'bun'}
					Doména je připravená; kód a běžící aplikaci je potřeba nasadit zvlášť.
				{/if}
				DNS záznam domény nasměrujte na <span class="mono">2.31.25.249</span>.
			</span>
			<Button size="sm" onclick={() => (dismissed = true)}>Mám uloženo, skrýt</Button>
		</div>
	</section>
{/if}

{#if !data.sites}
	<BrokerDown error={data.error} enabled={data.enabled} />
{:else}
	<DataTable
		rows={data.sites}
		{columns}
		search={(r) => `${r.domain} ${r.user} ${r.kind} ${r.client} ${r.services.map((s) => s.label + ' ' + s.customer).join(' ')}`}
		empty="Na serveru zatím není žádný web."
		initialSort={{ column: 0, dir: 'asc' }}
	>
		{#snippet row(s)}
			{@const days = daysUntil(s.expiresAt)}
			{@const kindBrand = siteKindBrand(s.kind)}
			<tr>
				<td class="py-1.5">
					<a class="font-semibold hover:underline" href="https://{s.domain}" target="_blank" rel="noreferrer">{s.domain}</a>
					<div class="mono text-[11px] text-muted">{s.user}</div>
				</td>
				<td class="whitespace-nowrap">
					<span class="inline-flex items-center gap-2">{#if kindBrand}<BrandIcon name={kindBrand} />{/if}{SITE_KIND_LABEL[s.kind] ?? s.kind}</span>
				</td>
				<td class="text-sm">{s.client || 'Nepřiřazený'}</td>
				<td class="whitespace-nowrap">
					{#if s.expiresAt}
						<span class="mono text-xs {days != null && days < 0 ? 'text-bad' : days != null && days <= 30 ? 'text-warn' : ''}">{date(s.expiresAt)}</span>
					{:else}
						<span class="text-xs text-muted">Nenastavená</span>
					{/if}
				</td>
				<td>
					{#each s.services as svc (svc.id)}
						<a class="block max-w-56 truncate text-xs hover:underline" href="/admin/sluzby/{svc.id}" title="{svc.label} · {svc.customer}">
							{svc.label} <span class="text-muted">· {SERVICE_STATUS_LABEL[svc.status]}</span>
						</a>
					{:else}
						<span class="text-xs text-muted">Bez služby</span>
					{/each}
				</td>
				<td class="whitespace-nowrap">
					{#if s.suspended}<Pill tone="bad">Pozastaveno</Pill>{:else}<Pill tone="ok">Běží</Pill>{/if}
					{#if s.manualHold}<span class="ml-1 text-[11px] text-muted" title="Ruční výjimka z vypínání za neplacení">výjimka</span>{/if}
				</td>
				<td class="text-right whitespace-nowrap">
					{#if s.app}
						<span class="text-xs text-muted" title="Aplikaci je potřeba zastavit v CloudPanelu">jen v CloudPanelu</span>
					{:else if s.suspended}
						<form
							method="POST"
							action="?/webState"
							use:enhance={(input) => {
								pending = s.domain;
								return keepResult({ onDone: () => (pending = null) })(input);
							}}
						>
							<input type="hidden" name="domain" value={s.domain} />
							<input type="hidden" name="suspend" value="false" />
							<Button type="submit" size="sm" disabled={pending === s.domain}>{pending === s.domain ? 'Obnovuji' : 'Obnovit web'}</Button>
						</form>
					{:else if confirming === s.domain}
						<form
							method="POST"
							action="?/webState"
							class="flex items-center justify-end gap-1.5"
							use:enhance={(input) => {
								pending = s.domain;
								return keepResult({ onDone: () => ((pending = null), (confirming = null)) })(input);
							}}
						>
							<input type="hidden" name="domain" value={s.domain} />
							<input type="hidden" name="suspend" value="true" />
							<span class="text-xs font-semibold text-bad">Web začne vracet 503.</span>
							<Button type="submit" size="sm" variant="danger" disabled={pending === s.domain}>{pending === s.domain ? 'Pozastavuji' : 'Pozastavit'}</Button>
							<Button size="sm" variant="ghost" onclick={() => (confirming = null)}>Zrušit</Button>
						</form>
					{:else}
						<Button size="sm" variant="ghost" onclick={() => (confirming = s.domain)}>Pozastavit</Button>
					{/if}
				</td>
			</tr>
		{/snippet}
	</DataTable>
	<p class="mt-2 text-xs text-muted">
		Pozastavení vrátí návštěvníkům chybu 503 a vyřadí web z údržby WordPressu, dokud ho neobnovíte. Node.js a Bun aplikace se zastavují v CloudPanelu.
	</p>

	<Panel title="Nový web" class="mt-5">
		<form
			method="POST"
			action="?/createSite"
			use:enhance={(input) => {
				creating = true;
				return keepResult({ reset: true, onDone: () => (creating = false) })(input);
			}}
			class="grid gap-3 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_auto] md:items-end"
		>
			<Field label="Doména" id="new-domain">
				<input id="new-domain" name="domain" class="input mono" placeholder="klient.cz" required maxlength="253" autocomplete="off" value={values?.domain ?? ''} />
			</Field>
			<Field label="Typ" id="new-kind">
				<select id="new-kind" name="kind" class="input" bind:value={kind}>
					{#each SITE_KINDS as k (k)}<option value={k}>{SITE_KIND_LABEL[k]}</option>{/each}
				</select>
			</Field>
			{#if needsPort}
				<Field label="Port aplikace" id="new-port">
					<input id="new-port" name="port" type="number" min="3000" max="9999" class="input mono" value={values?.port ?? '3000'} required />
				</Field>
			{:else}
				<div class="hidden md:block"></div>
			{/if}
			<Button type="submit" variant="primary" disabled={creating}>{creating ? 'Zakládám' : 'Založit web'}</Button>
		</form>
		{#if creating}
			<p class="mt-3 flex items-center gap-2 text-sm text-accent" role="status">
				<Pill tone="act">Pracuji</Pill> Zakládám web. Instalace WordPressu může trvat několik minut, stránku nezavírejte.
			</p>
		{:else}
			<p class="mt-3 text-xs text-muted">
				WordPress se nainstaluje automaticky (čeština, uživatel admin). U Node.js a Bun se připraví jen doména a proxy na zvolený port. DNS záznam
				nasměrujte na <span class="mono">2.31.25.249</span>. Po založení web propojte se službou zákazníka v detailu služby.
			</p>
		{/if}
	</Panel>
{/if}
