<script lang="ts">
	import { Printer } from '@lucide/svelte';
	import Button from '#lib/components/Button.svelte';
	import PageHeader from '#lib/components/PageHeader.svelte';
	import PaymentSlip from '#lib/components/PaymentSlip.svelte';
	import PaymentStatus from '#lib/components/PaymentStatus.svelte';
	import { czk, date } from '#lib/format.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const p = $derived(data.p);
	const s = $derived(data.supplier);
	const c = $derived(data.customer);
</script>

<div class="print:hidden">
	<PageHeader title="Výzva k platbě {p.vs}" crumbs={[{ href: '/app/faktury', label: 'Faktury' }]}>
		{#snippet meta()}<PaymentStatus status={p.status} dueDate={p.dueDate} />{/snippet}
		{#snippet actions()}
			<Button variant="primary" onclick={() => window.print()}><Printer size={15} />Vytisknout</Button>
		{/snippet}
	</PageHeader>
</div>

<article class="sheet mx-auto max-w-[820px] rounded-[6px] border border-line bg-surface p-5 sm:p-8" aria-label="Zálohová výzva k platbě {p.vs}">
	<header class="flex flex-wrap items-start justify-between gap-4 border-b border-line pb-4">
		<div>
			<div class="text-xs font-semibold tracking-[0.12em] text-muted uppercase">Zálohová výzva k platbě</div>
			<h2 class="mono mt-1 text-2xl font-semibold">{p.vs}</h2>
		</div>
		<dl class="grid grid-cols-[auto_auto] gap-x-4 gap-y-0.5 text-sm">
			<dt class="text-muted">Vystaveno</dt><dd class="mono text-right">{date(p.createdAt)}</dd>
			<dt class="text-muted">Splatnost</dt><dd class="mono text-right font-semibold">{date(p.dueDate)}</dd>
			<dt class="text-muted">Variabilní symbol</dt><dd class="mono text-right">{p.vs}</dd>
		</dl>
	</header>

	<div class="grid gap-5 border-b border-line py-4 sm:grid-cols-2 print:grid-cols-2">
		<section>
			<h3 class="mb-1 text-xs font-semibold tracking-[0.08em] text-muted uppercase">Dodavatel</h3>
			<div class="text-sm">
				<div class="font-bold">{s.name}</div>
				{#if s.address}<div>{s.address}</div>{/if}
				{#if s.ico}<div>IČO <span class="mono">{s.ico}</span></div>{/if}
				{#if s.dic}<div>DIČ <span class="mono">{s.dic}</span></div>{:else}<div>Neplátce DPH</div>{/if}
			</div>
		</section>
		<section>
			<h3 class="mb-1 text-xs font-semibold tracking-[0.08em] text-muted uppercase">Odběratel</h3>
			<div class="text-sm">
				<div class="font-bold">{c.company || c.name}</div>
				{#if c.company}<div>{c.name}</div>{/if}
				{#if c.address}<div>{c.address}</div>{/if}
				{#if c.ico}<div>IČO <span class="mono">{c.ico}</span></div>{/if}
				{#if c.dic}<div>DIČ <span class="mono">{c.dic}</span></div>{/if}
				<div class="break-all">{c.email}</div>
			</div>
		</section>
	</div>

	<div class="overflow-x-auto">
		<table class="w-full border-collapse text-sm">
			<thead>
				<tr class="text-left text-xs text-muted">
					<th scope="col" class="border-b border-line py-2 pr-3 font-semibold">Položka</th>
					<th scope="col" class="border-b border-line py-2 text-right font-semibold whitespace-nowrap">Částka</th>
				</tr>
			</thead>
			<tbody>
				<tr>
					<td class="border-b border-line py-2.5 pr-3">{p.description}</td>
					<td class="mono border-b border-line py-2.5 text-right whitespace-nowrap">{czk(p.net)}</td>
				</tr>
				{#if p.vatRate > 0}
					<tr>
						<td class="border-b border-line py-2.5 pr-3 text-muted">DPH {p.vatRate} %</td>
						<td class="mono border-b border-line py-2.5 text-right whitespace-nowrap">{czk(p.amount - p.net)}</td>
					</tr>
				{/if}
			</tbody>
			<tfoot>
				<tr>
					<th scope="row" class="pt-3 pr-3 text-left text-base font-bold">K úhradě</th>
					<td class="mono pt-3 text-right text-lg font-semibold whitespace-nowrap">{czk(p.amount)}</td>
				</tr>
			</tfoot>
		</table>
		{#if p.vatRate === 0}<p class="mt-1 text-xs text-muted">Nejsme plátci DPH.</p>{/if}
	</div>

	<section class="mt-6">
		{#if p.status === 'unpaid'}
			<h3 class="mb-3 text-xs font-semibold tracking-[0.08em] text-muted uppercase">Platební údaje</h3>
			<PaymentSlip qr={data.qr} amount={p.amount} vs={p.vs} account={s.account} iban={s.iban} dueDate={p.dueDate} />
		{:else if p.status === 'paid'}
			<div class="rounded-[6px] border border-ok/30 bg-ok-bg px-4 py-3 text-sm text-ok">
				<span class="font-semibold">Zaplaceno {date(p.paidAt)}.</span>
				{#if p.invoiceRef}Daňový doklad: Faktura <span class="mono">{p.invoiceRef}</span>.{:else}Daňový doklad vám pošleme e-mailem.{/if}
			</div>
		{:else}
			<div class="rounded-[6px] border border-line bg-surface-2 px-4 py-3 text-sm">Výzva byla zrušena. Nic z ní neplaťte.</div>
		{/if}
	</section>

	<footer class="mt-6 border-t border-line pt-3 text-xs text-muted">
		Toto není daňový doklad. Daňový doklad vystavíme po připsání platby na náš účet.{p.coversUntil ? ` Platba prodlužuje službu do ${date(p.coversUntil)}.` : ''}
	</footer>
</article>

<style>
	@media print {
		@page {
			size: A4;
			margin: 16mm 14mm;
		}
		:global(:root) {
			--bg: #fff !important;
			--surface: #fff !important;
			--surface-2: #f4f4f4 !important;
			--line: #c8c8c8 !important;
			--ink: #000 !important;
			--muted: #444 !important;
			--ok: #0d5f3a !important;
			--ok-bg: #fff !important;
			color-scheme: light;
		}
		:global(body) {
			background: #fff !important;
		}
		.sheet {
			max-width: none;
			border: 0;
			padding: 0;
		}
	}
</style>
