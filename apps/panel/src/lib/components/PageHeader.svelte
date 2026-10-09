<script lang="ts">
	import type { Snippet } from 'svelte';
	let {
		title,
		crumbs = [],
		meta,
		actions
	}: { title: string; crumbs?: { href: string; label: string }[]; meta?: Snippet; actions?: Snippet } = $props();
</script>

<svelte:head><title>{title} · SERVEROS</title></svelte:head>

<header class="mb-5 flex flex-wrap items-end justify-between gap-3">
	<div class="min-w-0">
		{#if crumbs.length}
			<nav aria-label="Drobečková navigace" class="mb-1 flex flex-wrap gap-1 text-xs text-muted">
				{#each crumbs as c, i (c.href)}
					<a href={c.href} class="hover:text-ink hover:underline">{c.label}</a>
					{#if i < crumbs.length - 1}<span aria-hidden="true">/</span>{/if}
				{/each}
			</nav>
		{/if}
		<h1 class="truncate text-[22px] leading-tight font-extrabold tracking-[-0.01em]" style="font-variation-settings: 'wdth' 92">
			{title}
		</h1>
		{#if meta}<div class="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">{@render meta()}</div>{/if}
	</div>
	{#if actions}<div class="flex flex-wrap items-center gap-2">{@render actions()}</div>{/if}
</header>
