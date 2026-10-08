<script lang="ts">
	// QR payment code plus the bank details to type by hand. The QR sits on white in both themes so banking apps can read it.
	import { czk, date } from '../format';
	import CopyButton from './CopyButton.svelte';

	let {
		qr,
		amount,
		vs,
		account,
		iban,
		dueDate,
		copy = true
	}: { qr: string | null; amount: number; vs: string; account: string; iban: string; dueDate: string; copy?: boolean } = $props();

	const rows = $derived(
		[
			{ k: 'Částka', v: czk(amount), raw: String(amount), strong: true },
			{ k: 'Číslo účtu', v: account, raw: account },
			{ k: 'Variabilní symbol', v: vs, raw: vs, strong: true },
			{ k: 'IBAN', v: iban, raw: iban },
			{ k: 'Splatnost', v: date(dueDate), raw: '' }
		].filter((r) => r.v)
	);
</script>

<div class="slip flex flex-col gap-4 sm:flex-row sm:items-start">
	{#if qr}
		<figure class="flex shrink-0 flex-col items-center gap-1.5">
			<div class="qr size-44 rounded-[6px] border border-line bg-white p-2.5" role="img" aria-label="QR kód pro platbu {czk(amount)}, variabilní symbol {vs}">
				{@html qr}
			</div>
			<figcaption class="text-xs text-muted">Naskenujte v aplikaci banky</figcaption>
		</figure>
	{/if}
	<dl class="grid min-w-0 flex-1 grid-cols-1 content-start gap-x-3 text-sm sm:grid-cols-[minmax(110px,auto)_1fr] print:grid-cols-[minmax(110px,auto)_1fr]">
		{#each rows as r (r.k)}
			<dt class="pt-2 text-xs text-muted sm:border-b sm:border-line sm:py-2 sm:text-sm print:border-b print:border-line print:py-2 print:text-sm">{r.k}</dt>
			<dd class="flex min-w-0 items-center justify-between gap-2 border-b border-line pt-0.5 pb-1.5 sm:py-1.5 print:py-1.5">
				<span class="mono min-w-0 break-all {r.strong ? 'text-base font-semibold' : ''}">{r.v}</span>
				{#if copy && r.raw}<span class="shrink-0 print:hidden"><CopyButton value={r.raw} label="Kopírovat" /></span>{/if}
			</dd>
		{/each}
	</dl>
</div>
{#if !account && !qr}
	<p class="mt-2 text-xs text-muted">Bankovní spojení zatím není nastavené. Napište nám a pošleme ho.</p>
{/if}

<style>
	.qr :global(svg) {
		display: block;
		width: 100%;
		height: 100%;
	}
</style>
