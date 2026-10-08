<script lang="ts">
	import type { Snippet } from 'svelte';
	let { title, children }: { title: string; children?: Snippet } = $props();
</script>

<div class="flex flex-col items-center gap-2 px-6 py-12 text-center">
	<div class="flex gap-1" aria-hidden="true">
		{#each [0, 1, 2] as i (i)}<span class="h-1.5 w-6 rounded-full bg-line"></span>{/each}
	</div>
	<p class="font-semibold">{title}</p>
	{#if children}<div class="max-w-sm text-sm text-muted">{@render children()}</div>{/if}
</div>
