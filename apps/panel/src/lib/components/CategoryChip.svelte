<script lang="ts">
	import { categoryLabel } from '../requests.ts';
	let { category }: { category: string } = $props();
</script>

<span
	class="inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap {category === 'incident'
		? 'border-bad/30 bg-bad-bg text-bad'
		: 'border-line bg-surface-2 text-muted'}">{categoryLabel(category)}</span
>
