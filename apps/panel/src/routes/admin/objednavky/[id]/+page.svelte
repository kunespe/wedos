<script lang="ts">
	import { enhance } from '$app/forms';
	import { keepResult } from '#lib/forms.ts';
	import { Check, Copy, ExternalLink } from '@lucide/svelte';
	import Button from '#lib/components/Button.svelte';
	import FormMessage from '#lib/components/FormMessage.svelte';
	import PageHeader from '#lib/components/PageHeader.svelte';
	import Panel from '#lib/components/Panel.svelte';
	import Pill from '#lib/components/Pill.svelte';
	import { czk, dateTime, periodTotal, SERVICE_STATUS_LABEL } from '#lib/format.ts';
	import { nextStatuses, ORDER_STATUS_LABEL } from '#lib/orders.ts';
	import PaymentList from '../../platby/PaymentList.svelte';
	import OrderStatus from '../OrderStatus.svelte';
	import SourceChip from '../SourceChip.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const o = $derived(data.order);
	let copied = $state(false);

	const rows = $derived([
		['Jméno', o.name],
		['E-mail', o.email],
		['Telefon', o.phone],
		['Firma', o.company],
		['IČO', o.ico],
		['DIČ', o.dic],
		['Adresa', o.address]
	].filter(([, v]) => v));

	const STEP: Record<string, string> = {
		new: 'Zavolejte nebo napište zákazníkovi a potvrďte, co přesně potřebuje.',
		contacted: 'Domluveno? Založte zákazníka a službu, pak zřiďte server ručně.',
		provisioning: 'Zřiďte službu (CloudPanel, Hetzner), v detailu služby ji přepněte na „Běží“ a předejte přístupy.',
		done: 'Hotovo. Služba běží a zákazník má přístup.',
		cancelled: 'Objednávka je zrušená.'
	};

	async function copy(text: string) {
		await navigator.clipboard.writeText(text);
		copied = true;
		setTimeout(() => (copied = false), 1500);
	}
</script>

<PageHeader title="Objednávka #{o.id}" crumbs={[{ href: '/admin/objednavky', label: 'Objednávky' }]}>
	{#snippet meta()}
		<OrderStatus status={o.status} />
		{#if o.source === 'panel'}<SourceChip />{/if}
		<span>přišla {dateTime(o.createdAt)}</span>
		{#if o.ip}<span class="mono text-xs">{o.ip}</span>{/if}
	{/snippet}
	{#snippet actions()}
		{#each nextStatuses(o.status) as s (s)}
			<form method="POST" action="?/status" use:enhance={keepResult()}>
				<input type="hidden" name="status" value={s} />
				<Button type="submit" size="sm" variant={s === 'cancelled' ? 'danger' : 'secondary'}>{ORDER_STATUS_LABEL[s]}</Button>
			</form>
		{/each}
	{/snippet}
</PageHeader>

<FormMessage {form} />

{#if form?.invite}
	<div class="mb-5 rounded-[6px] border border-accent/30 bg-info-bg p-4">
		<div class="text-sm font-bold">Pozvánka pro zákazníka</div>
		<p class="mt-1 text-sm text-muted">
			{form.mailed ? 'Odeslali jsme ji e-mailem. Odkaz pro jistotu i tady:' : 'Pošlete tento odkaz zákazníkovi (platí 7 dní):'}
		</p>
		<div class="mt-2 flex items-center gap-2">
			<code class="mono min-w-0 flex-1 truncate rounded-[6px] border border-line bg-surface px-2.5 py-1.5 text-xs">{form.invite}</code>
			<Button size="sm" onclick={() => copy(form.invite!)}>
				{#if copied}<Check size={14} /> Zkopírováno{:else}<Copy size={14} /> Kopírovat{/if}
			</Button>
		</div>
	</div>
{/if}

<div class="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
	<div class="flex flex-col gap-5">
		<div class="flex items-start gap-3 rounded-[6px] bg-surface-2 px-4 py-3 text-sm">
			<span class="mono mt-0.5 text-xs font-medium text-muted">DALŠÍ KROK</span>
			<span>{STEP[o.status]}</span>
		</div>

		<Panel title="Tarif">
			<div class="flex flex-wrap items-baseline justify-between gap-3">
				<div>
					<div class="text-lg font-bold">{data.plan?.name ?? o.planCode}</div>
					<div class="text-sm text-muted">{o.period === 'year' ? 'Platba ročně' : 'Platba měsíčně'}</div>
				</div>
				<div class="text-right">
					<div class="mono text-lg">
						{o.priceMonthly == null ? 'Individuálně' : czk(periodTotal(o.priceMonthly, o.period))}
					</div>
					<div class="text-xs text-muted">{o.priceMonthly == null ? 'nacenit' : o.period === 'year' ? 'za rok bez DPH' : 'za měsíc bez DPH'}</div>
				</div>
			</div>
			{#if o.domain}
				<div class="mt-4 flex items-center gap-2 border-t border-line pt-3 text-sm">
					<span class="text-muted">Doména</span>
					<span class="mono font-medium">{o.domain}</span>
					<Pill tone={o.domainMode === 'register' ? 'warn' : 'off'}>{o.domainMode === 'register' ? 'registrovat' : 'vlastní'}</Pill>
				</div>
			{/if}
			{#if o.note}
				<div class="mt-4 border-t border-line pt-3">
					<div class="label">Poznámka zákazníka</div>
					<p class="text-sm whitespace-pre-wrap">{o.note}</p>
				</div>
			{/if}
		</Panel>

		<Panel title="Průběh" flush>
			<ol>
				{#each data.notes as n (n.id)}
					<li class="border-b border-line px-4 py-3 text-sm last:border-b-0">
						<div class="mb-0.5 flex gap-2 text-xs text-muted">
							<span class="font-semibold text-ink">{n.author ?? 'Systém'}</span>
							<span>{dateTime(n.createdAt)}</span>
						</div>
						<p class="whitespace-pre-wrap">{n.body}</p>
					</li>
				{:else}
					<li class="px-4 py-3 text-sm text-muted">Zatím bez poznámek.</li>
				{/each}
			</ol>
			<form method="POST" action="?/note" use:enhance={keepResult({ reset: true })} class="flex flex-col gap-2 border-t border-line p-3">
				<label class="sr-only" for="note-body">Nová poznámka</label>
				<textarea id="note-body" name="body" class="input" placeholder="Co jste domluvili, co je hotové" required></textarea>
				<div class="flex justify-end"><Button type="submit" size="sm">Přidat poznámku</Button></div>
			</form>
		</Panel>
	</div>

	<div class="flex flex-col gap-5">
		<Panel title="Zákazník">
			<dl class="grid grid-cols-[90px_1fr] gap-x-3 gap-y-1.5 text-sm">
				{#each rows as [k, v] (k)}
					<dt class="text-muted">{k}</dt>
					<dd class="min-w-0 break-words">{#if k === 'E-mail'}<a class="underline" href="mailto:{v}">{v}</a>{:else if k === 'Telefon'}<a class="underline" href="tel:{v}">{v}</a>{:else}{v}{/if}</dd>
				{/each}
			</dl>
			{#if o.ico}
				<a class="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-accent hover:underline" target="_blank" rel="noreferrer" href="https://ares.gov.cz/ekonomicke-subjekty?ico={o.ico}">
					Ověřit v ARES <ExternalLink size={12} />
				</a>
			{/if}
		</Panel>

		<Panel title="Převzetí">
			<!-- A panel order has its customer from the start; it counts as converted once a service exists. -->
			{#if data.customer && (data.linked.length || o.source !== 'panel')}
				<p class="text-sm">
					Převedeno na zákazníka
					<a class="font-semibold underline" href="/admin/zakaznici/{data.customer.id}">{data.customer.company || data.customer.name}</a>.
				</p>
				<ul class="mt-3 flex flex-col gap-2 text-sm">
					{#each data.linked as s (s.id)}
						<li class="flex items-center justify-between gap-2">
							<a class="truncate underline" href="/admin/sluzby/{s.id}">{s.label}</a>
							<Pill tone={s.status === 'active' ? 'ok' : s.status === 'pending' ? 'act' : 'off'}>{SERVICE_STATUS_LABEL[s.status]}</Pill>
						</li>
					{/each}
				</ul>
				{#if data.linked.length}
					<div class="-mx-4 mt-4 -mb-4 overflow-hidden rounded-b-[6px] border-t border-line">
						{#if data.payments.length}
							<PaymentList rows={data.payments} />
						{/if}
						{#if !data.payments.some((p) => p.status !== 'cancelled')}
							<form method="POST" action="?/firstPayment" use:enhance={keepResult()} class="flex flex-col gap-2 p-4">
								<p class="text-sm text-muted">Záloha za {o.period === 'year' ? 'první rok' : 'první měsíc'} služby. Po úhradě se služba prodlouží.</p>
								<Button type="submit" variant="primary">Vystavit výzvu za první období</Button>
							</form>
						{/if}
					</div>
				{/if}
			{:else if o.status === 'cancelled' || o.status === 'done'}
				<p class="text-sm text-muted">Uzavřená objednávka se nepřevádí.</p>
			{:else}
				<form method="POST" action="?/convert" use:enhance={keepResult()} class="flex flex-col gap-3">
					{#if o.source === 'panel' && data.customer}
						<p class="text-sm text-muted">
							Objednal přihlášený zákazník
							<a class="font-semibold text-ink underline" href="/admin/zakaznici/{data.customer.id}">{data.customer.company || data.customer.name}</a>. Přidá mu službu ve stavu
							„Zřizujeme“, účet už má. Na serveru se nic nespustí.
						</p>
					{:else}
						<p class="text-sm text-muted">
							Založí zákazníka (nebo použije existujícího se stejným e-mailem či IČO), klientský účet a službu ve stavu „Zřizujeme“. Na serveru se nic nespustí.
						</p>
					{/if}
					{#if data.plan?.kind !== 'vps' && data.plan?.kind !== 'management'}
						<div>
							<label class="label" for="node">Uzel</label>
							<select id="node" name="node" class="input">
								{#each data.nodes as n (n.id)}<option value={n.id}>{n.name} ({n.host})</option>{/each}
							</select>
						</div>
					{/if}
					{#if o.source === 'panel' && data.customer}
						<Button type="submit" variant="primary">Přidat službu zákazníkovi</Button>
					{:else}
						<label class="flex items-center gap-2 text-sm">
							<input type="checkbox" name="send" checked class="size-4 accent-[var(--accent)]" />
							Poslat zákazníkovi pozvánku e-mailem
						</label>
						<Button type="submit" variant="primary">Založit zákazníka a službu</Button>
					{/if}
				</form>
			{/if}
		</Panel>

		<Panel title="Řeší">
			<form method="POST" action="?/assign" use:enhance={keepResult()} class="flex gap-2">
				<label class="sr-only" for="assignee">Řešitel</label>
				<select id="assignee" name="assignee" class="input">
					<option value="">Nikdo</option>
					{#each data.admins as a (a.id)}<option value={a.id} selected={a.id === o.assigneeId}>{a.name}</option>{/each}
				</select>
				<Button type="submit">Uložit</Button>
			</form>
		</Panel>
	</div>
</div>
