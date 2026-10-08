<script lang="ts">
	import { enhance } from '$app/forms';
	import { keepResult } from '#lib/forms.ts';
	import Button from '#lib/components/Button.svelte';
	import Field from '#lib/components/Field.svelte';
	import FormMessage from '#lib/components/FormMessage.svelte';
	import Led from '#lib/components/Led.svelte';
	import PageHeader from '#lib/components/PageHeader.svelte';
	import Panel from '#lib/components/Panel.svelte';
	import { SERVICE_STATUSES } from '#lib/constants.ts';
	import { czk, date, dateTime, daysUntil, KIND_LABEL, periodTotal, SERVICE_STATUS_LABEL } from '#lib/format.ts';
	import ServiceStatus from '../ServiceStatus.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const s = $derived(data.service);
	const h = $derived(data.health);
	const errors = $derived<Record<string, string>>(form && 'errors' in form ? (form.errors ?? {}) : {});
	let confirmSuspend = $state(false);
	const days = $derived(daysUntil(s.expiresAt));
	const err = (k: string) => (errors[k] ? { 'aria-invalid': 'true' as const, 'aria-describedby': `f-${k}-error` } : {});
</script>

<PageHeader title={s.label} crumbs={[{ href: '/admin/sluzby', label: 'Služby' }, { href: `/admin/zakaznici/${data.customer.id}`, label: data.customer.company || data.customer.name }]}>
	{#snippet meta()}
		<ServiceStatus status={s.status} />
		<span>{KIND_LABEL[s.kind]}</span>
		{#if data.order}<a class="underline" href="/admin/objednavky/{data.order.id}">z objednávky #{data.order.id}</a>{/if}
		<span class="text-xs">upraveno {dateTime(s.updatedAt)}</span>
	{/snippet}
	{#snippet actions()}
		{#if s.domain}<Button href="https://{s.domain}" target="_blank" rel="noreferrer">Otevřít web</Button>{/if}
	{/snippet}
</PageHeader>

<FormMessage {form} />

{#if s.status === 'pending'}
	<div class="mb-5 flex items-start gap-3 rounded-[6px] bg-info-bg px-4 py-3 text-sm">
		<Led state="act" pulse />
		<div>
			<div class="font-semibold">Služba čeká na ruční zřízení</div>
			<div class="text-muted">
				Zřiďte ji podle runbooku (docs/runbook-objednavka.md). Potom vyplňte web v CloudPanelu, předplatné ve Fakturoru a expiraci a přepněte stav na „Běží“. Tím se zapne i monitoring.
			</div>
		</div>
	</div>
{/if}

<div class="grid gap-5 xl:grid-cols-[1.5fr_1fr]">
	<form method="POST" action="?/update" use:enhance={keepResult()}>
		<Panel title="Nastavení služby">
			<div class="grid gap-4 sm:grid-cols-2">
				<Field label="Název" id="f-label" error={errors.label} class="sm:col-span-2">
					<input class="input" id="f-label" name="label" value={s.label} required {...err('label')} />
				</Field>
				<Field label="Tarif" id="f-plan">
					<select class="input" id="f-plan" name="planCode">
						<option value="">Bez tarifu</option>
						{#each data.plans as p (p.code)}<option value={p.code} selected={p.code === s.planCode}>{p.name}{p.active ? '' : ' (nenabízí se)'}</option>{/each}
					</select>
				</Field>
				<Field label="Stav" id="f-status">
					<select class="input" id="f-status" name="status">
						{#each SERVICE_STATUSES as st (st)}<option value={st} selected={st === s.status}>{SERVICE_STATUS_LABEL[st]}</option>{/each}
					</select>
				</Field>
				<Field label="Doména" id="f-domain" error={errors.domain}>
					<input class="input mono" id="f-domain" name="domain" value={s.domain} placeholder="firma.cz" {...err('domain')} />
				</Field>
				<Field label="Web v CloudPanelu" id="f-clp" hint="Doména, pod kterou web vede CloudPanel. Umožní pozastavení.">
					<input class="input mono" id="f-clp" name="cloudpanelSite" value={s.cloudpanelSite} />
				</Field>
				<Field label="Cena za měsíc bez DPH" id="f-price" error={errors.priceMonthly}>
					<input class="input mono" id="f-price" name="priceMonthly" inputmode="numeric" value={s.priceMonthly ?? ''} {...err('priceMonthly')} />
				</Field>
				<Field label="Fakturace" id="f-period">
					<select class="input" id="f-period" name="period">
						<option value="year" selected={s.period === 'year'}>Ročně</option>
						<option value="month" selected={s.period === 'month'}>Měsíčně</option>
					</select>
				</Field>
				<Field label="Uzel" id="f-node">
					<select class="input" id="f-node" name="nodeId">
						<option value="">Žádný</option>
						{#each data.nodes as n (n.id)}<option value={n.id} selected={n.id === s.nodeId}>{n.name} ({n.host})</option>{/each}
					</select>
				</Field>
				<Field label="Předplatné ve Fakturoru (ID)" id="f-fak" error={errors.fakturorSubscriptionId}>
					<input class="input mono" id="f-fak" name="fakturorSubscriptionId" inputmode="numeric" value={s.fakturorSubscriptionId ?? ''} {...err('fakturorSubscriptionId')} />
				</Field>
				<Field label="Zaplaceno do" id="f-exp" error={errors.expiresAt} hint="Poslední platný den. Po něm běží 7 dní tolerance.">
					<input class="input" id="f-exp" name="expiresAt" type="date" value={s.expiresAt ?? ''} {...err('expiresAt')} />
				</Field>
				<div class="flex flex-col justify-end gap-2 text-sm">
					<label class="flex items-center gap-2"><input type="checkbox" name="manualHold" checked={s.manualHold} class="size-4" /> Ruční držení (nikdy nepozastavovat)</label>
					<label class="flex items-center gap-2"><input type="checkbox" name="monitored" checked={s.monitored} class="size-4" /> Hlídat dostupnost a SSL</label>
				</div>
				<Field label="Interní poznámka" id="f-note" class="sm:col-span-2">
					<textarea class="input" id="f-note" name="note">{s.note ?? ''}</textarea>
				</Field>
			</div>
			<div class="mt-5 flex justify-end"><Button type="submit" variant="primary">Uložit</Button></div>
		</Panel>
	</form>

	<div class="flex flex-col gap-5">
		<Panel title="Dostupnost">
			{#if h.up == null && h.uptime30d == null}
				<p class="text-sm text-muted">{s.status === 'active' && s.monitored && s.domain ? 'Zatím bez měření. Monitoring načte cíl do pár minut.' : 'Služba se neměří (není aktivní, nemá doménu nebo je měření vypnuté).'}</p>
			{:else}
				<dl class="grid grid-cols-2 gap-3">
					<div class="rounded-[6px] bg-surface-2 p-3">
						<dt class="text-xs text-muted">Teď</dt>
						<dd class="mt-1 flex items-center gap-2 font-semibold"><Led state={h.up ? 'ok' : 'bad'} />{h.up ? 'Dostupná' : 'Nedostupná'}</dd>
					</div>
					<div class="rounded-[6px] bg-surface-2 p-3">
						<dt class="text-xs text-muted">30 dní</dt>
						<dd class="mono mt-1">{h.uptime30d == null ? '·' : `${h.uptime30d.toFixed(2).replace('.', ',')} %`}</dd>
					</div>
					<div class="rounded-[6px] bg-surface-2 p-3">
						<dt class="text-xs text-muted">Odezva</dt>
						<dd class="mono mt-1">{h.latencyMs == null ? '·' : `${h.latencyMs} ms`}</dd>
					</div>
					<div class="rounded-[6px] bg-surface-2 p-3">
						<dt class="text-xs text-muted">SSL platí</dt>
						<dd class="mono mt-1 {h.sslDays != null && h.sslDays < 14 ? 'text-bad' : ''}">{h.sslDays == null ? '·' : `${h.sslDays} dní`}</dd>
					</div>
				</dl>
			{/if}
		</Panel>

		<Panel title="Platba">
			<dl class="grid grid-cols-[110px_1fr] gap-y-1.5 text-sm">
				<dt class="text-muted">Cena</dt>
				<dd class="mono">{s.priceMonthly == null ? 'Individuálně' : `${czk(periodTotal(s.priceMonthly, s.period))} / ${s.period === 'year' ? 'rok' : 'měsíc'}`}</dd>
				<dt class="text-muted">Zaplaceno do</dt>
				<dd class="mono {days != null && days < 0 ? 'text-bad' : days != null && days <= 14 ? 'text-warn' : ''}">
					{date(s.expiresAt)}{days != null ? ` (${days < 0 ? `${-days} dní po` : `za ${days} dní`})` : ''}
				</dd>
				<dt class="text-muted">Fakturor</dt>
				<dd class="mono">{s.fakturorSubscriptionId ? `#${s.fakturorSubscriptionId}` : 'nepropojeno'}</dd>
			</dl>
			<p class="mt-3 text-xs text-muted">Pozastavení po splatnosti nikdy neproběhne samo. Vždy ho spouští člověk tady nebo v sekci Weby.</p>
		</Panel>

		{#if s.cloudpanelSite}
			<Panel title="Provoz webu">
				{#if !data.brokerEnabled}
					<p class="text-sm text-muted">Serverové operace nejsou v tomto prostředí zapnuté.</p>
				{:else if s.status === 'suspended'}
					<form method="POST" action="?/webState" use:enhance={keepResult()}>
						<input type="hidden" name="suspend" value="0" />
						<p class="mb-3 text-sm">Web <span class="mono">{s.cloudpanelSite}</span> je pozastavený.</p>
						<Button type="submit" variant="primary">Obnovit web</Button>
					</form>
				{:else if confirmSuspend}
					<form method="POST" action="?/webState" use:enhance={keepResult({ onDone: () => (confirmSuspend = false) })}>
						<input type="hidden" name="suspend" value="1" />
						<p class="mb-3 text-sm">Návštěvníci <span class="mono">{s.cloudpanelSite}</span> uvidí chybu 503, dokud web neobnovíte. Opravdu?</p>
						<div class="flex gap-2">
							<Button type="submit" variant="danger">Pozastavit</Button>
							<Button variant="ghost" onclick={() => (confirmSuspend = false)}>Zpět</Button>
						</div>
					</form>
				{:else}
					<Button variant="danger" onclick={() => (confirmSuspend = true)}>Pozastavit web</Button>
				{/if}
			</Panel>
		{/if}
	</div>
</div>
