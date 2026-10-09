<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { BrandName } from '../brands.ts';
	import BrandIcon from './BrandIcon.svelte';
	let {
		title,
		brand,
		actions,
		children,
		flush = false,
		class: cls = ''
	}: { title?: string; /** Official mark shown before the title. */ brand?: BrandName; actions?: Snippet; children: Snippet; flush?: boolean; class?: string } = $props();
</script>

<section class="rounded-[6px] border border-line bg-surface {cls}">
	{#if title || actions}
		<header class="flex min-h-11 items-center justify-between gap-3 border-b border-line px-4 py-2">
			{#if title}<h2 class="flex items-center gap-2 text-sm font-bold">{#if brand}<BrandIcon name={brand} />{/if}{title}</h2>{/if}
			{#if actions}<div class="flex items-center gap-2">{@render actions()}</div>{/if}
		</header>
	{/if}
	<div class={flush ? '' : 'p-4'}>{@render children()}</div>
</section>
