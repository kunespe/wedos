<script lang="ts">
	import { Mail } from '@lucide/svelte';
	import Button from '#lib/components/Button.svelte';
	import DataTable from '#lib/components/DataTable.svelte';
	import PageHeader from '#lib/components/PageHeader.svelte';
	import Panel from '#lib/components/Panel.svelte';
	import Pill from '#lib/components/Pill.svelte';
	import type { Column } from '#lib/components/table.ts';
	import { czk, date, periodTotal, SERVICE_STATUS_LABEL, YEARLY_MONTHS } from '#lib/format.ts';
	import { CONTACT, expiryHint, expiryTone, SERVICE_TONE, TEXT_TONE } from '../tones.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	type Row = (typeof data.subscriptions)[number];
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
	{#snippet meta()}Předplatné a fakturační údaje.{/snippet}
	{#snippet actions()}
		<Button href="mailto:{CONTACT.email}?subject={copySubject}&body={copyBody}"><Mail size={15} />Vyžádat kopii faktury</Button>
	{/snippet}
</PageHeader>

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
