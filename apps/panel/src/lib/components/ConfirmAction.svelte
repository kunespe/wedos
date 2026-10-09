<script lang="ts">
	import type { Snippet } from 'svelte';
	import { enhance } from '$app/forms';
	import { keepResult } from '#lib/forms.ts';
	import Button from './Button.svelte';

	// A form action behind an inline confirm step that states the WEDOS mode (test or live) and the price.
	let {
		action,
		label,
		confirmLabel = label,
		live,
		note,
		variant = 'secondary',
		disabled = false,
		fields
	}: {
		action: string;
		label: string;
		confirmLabel?: string;
		live: boolean;
		note: string;
		variant?: 'primary' | 'secondary' | 'danger';
		disabled?: boolean;
		fields?: Snippet;
	} = $props();
	let open = $state(false);
	let busy = $state(false);
</script>

<form
	method="POST"
	{action}
	class="flex flex-col gap-3"
	use:enhance={(input) => {
		busy = true;
		return keepResult({
			onDone: () => {
				busy = false;
				open = false;
			}
		})(input);
	}}
>
	{@render fields?.()}
	{#if open}
		<div class="rounded-[6px] border px-3 py-2.5 text-sm {live ? 'border-bad/40 bg-bad-bg' : 'border-warn/40 bg-warn-bg'}" role="alertdialog" aria-label="Potvrzení: {label}">
			<p class="font-bold {live ? 'text-bad' : 'text-warn'}">
				{live ? 'OSTRÝ REŽIM: změna se u WEDOS opravdu provede.' : 'TESTOVACÍ REŽIM: WEDOS požadavek jen ověří, nic se nezmění.'}
			</p>
			<p class="mt-1 text-ink">{note}</p>
			<div class="mt-3 flex flex-wrap gap-2">
				<Button type="submit" variant={live ? 'danger' : 'primary'} size="sm" disabled={busy}>{busy ? 'Odesílám' : `Potvrdit: ${confirmLabel}`}</Button>
				<Button variant="ghost" size="sm" onclick={() => (open = false)} disabled={busy}>Zpět</Button>
			</div>
		</div>
	{:else}
		<div><Button {variant} {disabled} onclick={() => (open = true)}>{label}</Button></div>
	{/if}
</form>
