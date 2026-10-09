<script lang="ts">
	import { Mail, Printer } from '@lucide/svelte';
	import Button from '#lib/components/Button.svelte';
	import DataTable from '#lib/components/DataTable.svelte';
	import PageHeader from '#lib/components/PageHeader.svelte';
	import Panel from '#lib/components/Panel.svelte';
	import PaymentSlip from '#lib/components/PaymentSlip.svelte';
	import PaymentStatus from '#lib/components/PaymentStatus.svelte';
	import Pill from '#lib/components/Pill.svelte';
	import type { Column } from '#lib/components/table.ts';
	import { czk, date, daysUntil, periodTotal, SERVICE_STATUS_LABEL, YEARLY_MONTHS } from '#lib/format.ts';
	import { CONTACT, expiryHint, expiryTone, SERVICE_TONE, TEXT_TONE } from '../tones.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	type Row = (typeof data.subscriptions)[number];
	type Paid = (typeof data.history)[number];
	const unpaidTotal = $derived(data.unpaid.reduce((sum, p) => sum + p.amount, 0));

	const historyColumns: Column<Paid>[] = [
		{ label: 'Za co', sort: (r) => r.description },
		{ label: 'VS', sort: (r) => r.vs },
		{ label: 'Částka', sort: (r) => r.amount, align: 'right' },
		{ label: 'Zaplaceno', sort: (r) => r.paidAt?.getTime() ?? null },
		{ label: 'Daňový doklad' }
	];
	const b = $derived(data.billing);

	const rows = $derived(
		[
			['Odběratel', b.company || b.name],
			['Kontakt', b.company ? b.name : ''],
			['IČO', b.ico],
			['DIČ', b.dic],
			['Adresa', b.address],
			['E-mail pro faktury', b.email],
			['Telefon', b.phone]
		].filter(([, v]) => v)
	);

	const copySubject = encodeURIComponent('Kopie faktury');
	const copyBody = $derived(encodeURIComponent(`Dobrý den,\n\nprosím o zaslání kopie faktury za období:\n\n${b.company || b.name}`));

	const columns: Column<Row>[] = [
		{ label: 'Služba', sort: (r) => r.label },
		{ label: 'Období', sort: (r) => r.period },
		{ label: 'Částka bez DPH', sort: (r) => (r.priceMonthly == null ? null : periodTotal(r.priceMonthly, r.period)), align: 'right' },
		{ label: 'Další platba', sort: (r) => r.expiresAt },
		{ label: 'Stav' }
	];
</script>

<PageHeader title="Faktury">
	{#snippet meta()}Platby, předplatné a fakturační údaje.{/snippet}
	{#snippet actions()}
		<Button href="mailto:{CONTACT.email}?subject={copySubject}&body={copyBody}"><Mail size={15} />Vyžádat kopii faktury</Button>
	{/snippet}
</PageHeader>

{#if data.unpaid.length}
	<section class="mb-6" aria-labelledby="k-uhrade-h">
		<div class="mb-2 flex flex-wrap items-baseline justify-between gap-2">
			<h2 id="k-uhrade-h" class="text-sm font-bold">K úhradě</h2>
			{#if data.unpaid.length > 1}<span class="text-xs text-muted">Celkem <span class="mono font-semibold text-ink">{czk(unpaidTotal)}</span></span>{/if}
		</div>
		<div class="flex flex-col gap-4">
			{#each data.unpaid as p (p.id)}
				{@const d = daysUntil(p.dueDate)}
				<article class="rounded-[6px] border bg-surface {d != null && d < 0 ? 'border-bad/40' : 'border-warn/40'}">
					<header class="flex flex-wrap items-start justify-between gap-3 border-b border-line px-4 py-3">
						<div class="min-w-0">
							<div class="font-bold">{p.description}</div>
							<div class="mt-0.5 text-xs text-muted">
								Zálohová výzva {p.vs}{d != null ? (d < 0 ? `, ${-d} ${-d === 1 ? 'den' : -d < 5 ? 'dny' : 'dní'} po splatnosti` : d === 0 ? ', splatná dnes' : `, splatná za ${d} ${d === 1 ? 'den' : d < 5 ? 'dny' : 'dní'}`) : ''}
							</div>
						</div>
						<div class="flex items-center gap-2">
							<PaymentStatus status={p.status} dueDate={p.dueDate} />
							<Button size="sm" href="/app/platby/{p.id}"><Printer size={14} />Výzva k tisku</Button>
						</div>
					</header>
					<div class="p-4">
						<PaymentSlip qr={p.qr} amount={p.amount} vs={p.vs} account={data.bank.account} iban={data.bank.iban} dueDate={p.dueDate} />
						<p class="mt-3 text-xs text-muted">
							Platbu u nás uvidí člověk na bankovním výpisu, obvykle do jednoho pracovního dne od připsání. Pak vám pošleme daňový doklad{p.coversUntil
								? ` a služba se prodlouží do ${date(p.coversUntil)}`
								: ''}.
						</p>
					</div>
				</article>
			{/each}
		</div>
	</section>
{/if}

<div class="mb-5 rounded-[6px] border border-line bg-surface-2 px-4 py-3 text-sm">
	<div class="font-bold">Faktury chodí e-mailem</div>
	<p class="mt-0.5 text-muted">
		Vystavujeme je ve fakturačním systému a posíláme na <span class="font-medium text-ink">{b.email}</span> vždy před začátkem
		dalšího období. Tady v panelu je zatím neuvidíte. Potřebujete starší fakturu znovu? Napište na
		<a class="font-semibold text-accent hover:underline" href="mailto:{CONTACT.email}?subject={copySubject}&body={copyBody}">{CONTACT.email}</a>
		a pošleme ji.
	</p>
</div>

<div class="grid gap-5 xl:grid-cols-[1.6fr_1fr]">
	<section class="min-w-0" aria-labelledby="predplatne-h">
		<h2 id="predplatne-h" class="mb-2 text-sm font-bold">Předplatné</h2>
		<DataTable rows={data.subscriptions} {columns} empty="Žádné aktivní předplatné.">
			{#snippet row(s)}
				{@const tone = expiryTone(s.expiresAt)}
				<tr>
					<td class="min-w-44">
						<a class="font-semibold hover:underline" href="/app/sluzby/{s.id}">{s.label}</a>
						{#if s.plan}<div class="text-xs text-muted">{s.plan}</div>{/if}
					</td>
					<td class="text-xs">{s.period === 'year' ? 'ročně' : 'měsíčně'}</td>
					<td class="mono text-right text-xs whitespace-nowrap">
						{s.priceMonthly == null ? 'Individuálně' : czk(periodTotal(s.priceMonthly, s.period))}
					</td>
					<td class="text-xs whitespace-nowrap">
						<span class="mono">{date(s.expiresAt)}</span>
						{#if s.expiresAt}<div class={TEXT_TONE[tone]}>{expiryHint(s.expiresAt)}</div>{/if}
					</td>
					<td><Pill tone={SERVICE_TONE[s.status]}>{SERVICE_STATUS_LABEL[s.status]}</Pill></td>
				</tr>
			{/snippet}
		</DataTable>
		<p class="mt-2 text-xs text-muted">Ceny jsou bez DPH. Při roční platbě platíte {YEARLY_MONTHS} měsíců místo 12.</p>
	</section>

	<Panel title="Fakturační údaje" class="min-w-0 self-start">
		<dl class="grid grid-cols-[minmax(90px,auto)_1fr] gap-x-3 gap-y-1.5 text-sm">
			{#each rows as [k, v] (k)}
				<dt class="text-muted">{k}</dt>
				<dd class="min-w-0 break-words {k === 'IČO' || k === 'DIČ' ? 'mono' : ''}">{v}</dd>
			{/each}
		</dl>
		<p class="mt-4 border-t border-line pt-3 text-xs text-muted">
			Něco nesedí?
			<a class="font-semibold text-accent hover:underline" href="/app/podpora/novy?predmet={encodeURIComponent('Změna fakturačních údajů')}">
				Změnu fakturačních údajů nám napište</a
			>, upravíme je od další faktury.
		</p>
	</Panel>
</div>

<section class="mt-6 min-w-0" aria-labelledby="historie-h">
	<h2 id="historie-h" class="mb-2 text-sm font-bold">Zaplacené výzvy</h2>
	<DataTable rows={data.history} columns={historyColumns} empty="Zatím žádné zaplacené výzvy." initialSort={{ column: 3, dir: 'desc' }}>
		{#snippet row(p)}
			<tr>
				<td class="min-w-48"><a class="hover:underline" href="/app/platby/{p.id}">{p.description}</a></td>
				<td class="mono text-xs">{p.vs}</td>
				<td class="mono text-right text-xs whitespace-nowrap">{czk(p.amount)}</td>
				<td class="mono text-xs whitespace-nowrap">{date(p.paidAt)}</td>
				<td class="text-xs whitespace-nowrap">
					{#if p.invoiceRef}Faktura <span class="mono">{p.invoiceRef}</span>{:else}<span class="text-muted">připravujeme</span>{/if}
				</td>
			</tr>
		{/snippet}
	</DataTable>
</section>
