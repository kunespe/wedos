<script lang="ts">
	// A service kind label with the mark of the technology it runs on (WordPress, PHP, Node.js or Bun).
	import { serviceKindBrand } from '../brands.ts';
	import { KIND_LABEL } from '../format.ts';
	import BrandIcon from './BrandIcon.svelte';

	let { kind, runtime, size = 14 }: { kind: string; /** App runtime when known ("bun"); apps default to Node.js. */ runtime?: string | null; size?: number } = $props();
	const brand = $derived(serviceKindBrand(kind, runtime));
</script>

<span class="inline-flex items-center gap-1.5 align-bottom">{#if brand}<BrandIcon name={brand} {size} />{/if}{KIND_LABEL[kind] ?? kind}</span>
