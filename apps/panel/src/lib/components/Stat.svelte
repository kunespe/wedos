<script lang="ts">
	let { label, value, hint, href }: { label: string; value: string | number; hint?: string; href?: string } = $props();
</script>

<svelte:element
	this={href ? 'a' : 'div'}
	{href}
	class="block rounded-[6px] border border-line bg-surface px-4 py-3 {href ? 'transition-colors hover:bg-surface-2' : ''}"
>
	<div class="text-xs font-semibold text-muted">{label}</div>
	<div class="mono mt-1 text-[24px] leading-none font-medium">{value}</div>
	{#if hint}<div class="mt-1.5 text-xs text-muted">{hint}</div>{/if}
</svelte:element>
