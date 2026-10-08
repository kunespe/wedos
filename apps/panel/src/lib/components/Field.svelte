<script lang="ts">
	import type { Snippet } from 'svelte';
	let {
		label,
		id,
		error,
		hint,
		children,
		class: cls = ''
	}: { label: string; id: string; error?: string; hint?: string; children: Snippet; class?: string } = $props();
</script>

<div class={cls}>
	<label class="label" for={id}>{label}</label>
	{@render children()}
	{#if error}
		<p id="{id}-error" class="mt-1 text-xs font-medium text-bad">{error}</p>
	{:else if hint}
		<p id="{id}-hint" class="mt-1 text-xs text-muted">{hint}</p>
	{/if}
</div>
