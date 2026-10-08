<script lang="ts">
	import { enhance } from '$app/forms';
	import { keepResult } from '#lib/forms.ts';
	import { Ban, Check, Mail } from '@lucide/svelte';
	import Button from '#lib/components/Button.svelte';
	import FormMessage from '#lib/components/FormMessage.svelte';
	import PageHeader from '#lib/components/PageHeader.svelte';
	import Panel from '#lib/components/Panel.svelte';
	import PaymentSlip from '#lib/components/PaymentSlip.svelte';
	import PaymentStatus from '#lib/components/PaymentStatus.svelte';
	import { czk, date, dateTime, daysUntil, SERVICE_STATUS_LABEL } from '#lib/format.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const p = $derived(data.p);
	const c = $derived(data.customer);
	const due = $derived(daysUntil(p.dueDate));
	let confirmCancel = $state(false);
</script>

<PageHeader title="Výzva {p.vs}" crumbs={[{ href: '/admin/platby', label: 'Platby' }, { href: `/admin/zakaznici/${c.id}`, label: c.company || c.name }]}>
	{#snippet meta()}
		<PaymentStatus status={p.status} dueDate={p.dueDate} />
		<span>vystavena {dateTime(p.createdAt)}{data.author ? `, ${data.author}` : ''}</span>
	{/snippet}
	{#snippet actions()}
		{#if p.status === 'unpaid'}
			<form method="POST" action="?/remind" use:enhance={keepResult()}>
				<Button type="submit"><Mail size={15} />{p.remindedAt || (due ?? 0) < 0 ? 'Připomenout e-mailem' : 'Poslat e-mailem'}</Button>
			</form>
			{#if confirmCancel}
				<form method="POST" action="?/cancel" use:enhance={keepResult({ onDone: () => (confirmCancel = false) })} class="flex gap-2">
					<Button type="submit" variant="danger">Opravdu zrušit</Button>
					<Button variant="ghost" onclick={() => (confirmCancel = false)}>Zpět</Button>
				</form>
			{:else}
				<Button variant="danger" onclick={() => (confirmCancel = true)}><Ban size={15} />Zrušit</Button>
			{/if}
		{/if}
	{/snippet}
</PageHeader>

<FormMessage {form} />

<div class="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
	<div class="flex min-w-0 flex-col gap-5">
		<Panel title="Výzva">
			<dl class="grid grid-cols-[120px_1fr] gap-x-3 gap-y-1.5 text-sm">
				<dt class="text-muted">Zákazník</dt>
				<dd class="min-w-0"><a class="font-semibold underline" href="/admin/zakaznici/{c.id}">{c.company || c.name}</a>{#if c.ico}<span class="mono ml-2 text-xs text-muted">IČO {c.ico}</span>{/if}</dd>
				<dt class="text-muted">Služba</dt>
				<dd class="min-w-0">
					{#if data.service}
						<a class="underline" href="/admin/sluzby/{data.service.id}">{data.service.label}</a>
						<span class="text-xs text-muted">({SERVICE_STATUS_LABEL[data.service.status]}, zaplaceno do {date(data.service.expiresAt)})</span>
					{:else}<span class="text-muted">Bez vazby na službu</span>{/if}
				</dd>
				<dt class="text-muted">Za co</dt>
				<dd>{p.description}</dd>
				<dt class="text-muted">Bez DPH</dt>
				<dd class="mono">{czk(p.net)}</dd>
				<dt class="text-muted">DPH</dt>
				<dd class="mono">{p.vatRate ? `${p.vatRate} %, ${czk(p.amount - p.net)}` : 'neplátce DPH'}</dd>
				<dt class="text-muted">K úhradě</dt>
				<dd class="mono font-semibold">{czk(p.amount)}</dd>
				<dt class="text-muted">Splatnost</dt>
				<dd class="mono {p.status === 'unpaid' && due != null && due < 0 ? 'font-semibold text-bad' : ''}">
					{date(p.dueDate)}{p.status === 'unpaid' && due != null ? ` (${due < 0 ? `${-due} dní po splatnosti` : due === 0 ? 'dnes' : `za ${due} dní`})` : ''}
				</dd>
				{#if p.coversUntil}
					<dt class="text-muted">Prodlouží do</dt>
					<dd class="mono">{date(p.coversUntil)}</dd>
				{/if}
				<dt class="text-muted">E-mailem</dt>
				<dd>{p.remindedAt ? `naposledy ${dateTime(p.remindedAt)}` : 'zatím neodesláno'}</dd>
				{#if p.paidAt}
					<dt class="text-muted">Zaplaceno</dt>
					<dd>{dateTime(p.paidAt)}</dd>
				{/if}
				{#if p.note}
					<dt class="text-muted">Poznámka</dt>
					<dd class="whitespace-pre-wrap">{p.note}</dd>
				{/if}
			</dl>
		</Panel>

		<Panel title="Platební údaje">
			<PaymentSlip qr={data.qr} amount={p.amount} vs={p.vs} account={data.supplier.account} iban={data.supplier.iban} dueDate={p.dueDate} />
			{#if !data.qr}<p class="mt-3 text-xs text-muted">QR kód se ukáže po nastavení PAYMENT_IBAN.</p>{/if}
		</Panel>
	</div>

	<div class="flex min-w-0 flex-col gap-5">
		{#if p.status === 'unpaid'}
			<Panel title="Úhrada">
				<form method="POST" action="?/paid" use:enhance={keepResult()} class="flex flex-col gap-3">
					<p class="text-sm text-muted">
						Platbu s VS <span class="mono font-semibold text-ink">{p.vs}</span> a částkou <span class="mono font-semibold text-ink">{czk(p.amount)}</span> najděte na
						výpisu.{p.coversUntil && data.service ? ` Služba se prodlouží do ${date(p.coversUntil)}.` : ''}
					</p>
					<div>
						<label class="label" for="f-inv">Číslo faktury ve Fakturoru</label>
						<input class="input mono" id="f-inv" name="invoiceRef" maxlength="60" placeholder="FA-2026-0001 (lze doplnit později)" />
					</div>
					<Button type="submit" variant="primary"><Check size={15} />Zaplaceno</Button>
				</form>
			</Panel>
		{:else if p.status === 'paid'}
			<Panel title="Daňový doklad">
				<form method="POST" action="?/invoice" use:enhance={keepResult()} class="flex flex-col gap-3">
					<p class="text-sm text-muted">Fakturu vystavte ve Fakturoru a sem zapište její číslo. Zákazník ho uvidí v historii plateb.</p>
					<div>
						<label class="label" for="f-inv2">Číslo faktury ve Fakturoru</label>
						<input class="input mono" id="f-inv2" name="invoiceRef" maxlength="60" value={p.invoiceRef} placeholder="FA-2026-0001" />
					</div>
					<div class="flex justify-end"><Button type="submit">Uložit</Button></div>
				</form>
			</Panel>
		{:else}
			<Panel title="Zrušeno">
				<p class="text-sm text-muted">Výzva je zrušená a nic se z ní neplatí. Potřebujete novou? Vystavte ji v detailu služby nebo zákazníka.</p>
			</Panel>
		{/if}

		<Panel title="Dodavatel">
			<dl class="grid grid-cols-[80px_1fr] gap-x-3 gap-y-1.5 text-sm">
				<dt class="text-muted">Název</dt><dd>{data.supplier.name}</dd>
				{#if data.supplier.ico}<dt class="text-muted">IČO</dt><dd class="mono">{data.supplier.ico}</dd>{/if}
				<dt class="text-muted">DPH</dt><dd>{data.supplier.dic ? `DIČ ${data.supplier.dic}` : 'neplátce'}</dd>
			</dl>
		</Panel>
	</div>
</div>
