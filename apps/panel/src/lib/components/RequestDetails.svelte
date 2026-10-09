<script lang="ts">
	import { describeDetails } from '../requests.ts';
	import CopyButton from './CopyButton.svelte';
	let { details, copy = false }: { details: Record<string, string> | null | undefined; copy?: boolean } = $props();
	const rows = $derived(describeDetails(details));
</script>

{#if rows.length}
	<dl class="text-sm">
		{#each rows as r (r.key)}
			<div class="grid gap-x-3 gap-y-0.5 border-b border-line py-2 last:border-b-0 sm:grid-cols-[150px_1fr_auto] sm:items-center">
				<dt class="text-xs text-muted">{r.label}</dt>
				<dd class="min-w-0 break-words {r.mono ? 'mono text-xs break-all' : ''}">{r.value}</dd>
				{#if copy && r.mono}<dd class="sm:justify-self-end"><CopyButton value={r.value} /></dd>{:else if copy}<dd></dd>{/if}
			</div>
		{/each}
	</dl>
{/if}
