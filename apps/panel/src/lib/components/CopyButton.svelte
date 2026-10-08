<script lang="ts">
	import { Check, Copy } from '@lucide/svelte';
	import Button from './Button.svelte';

	let { value, label = 'Kopírovat' }: { value: string; label?: string } = $props();
	let copied = $state(false);

	async function copy() {
		try {
			await navigator.clipboard.writeText(value);
			copied = true;
			setTimeout(() => (copied = false), 1500);
		} catch {
			copied = false;
		}
	}
</script>

<Button size="sm" onclick={copy} aria-label="{label}: {copied ? 'zkopírováno' : 'zkopírovat do schránky'}">
	{#if copied}<Check size={14} /> Zkopírováno{:else}<Copy size={14} /> {label}{/if}
</Button>
