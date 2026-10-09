<script lang="ts" module>
	// Vendored official marks (src/lib/assets/brands, sources in SOURCES.md). SVGs are inlined so they can take
	// currentColor; the few brands that publish only raster marks render as <img>.
	const svgs = import.meta.glob<string>('../assets/brands/*.svg', { query: '?raw', import: 'default', eager: true });
	const pngs = import.meta.glob<string>('../assets/brands/*.png', { query: '?url', import: 'default', eager: true });
	const file = (path: string) => path.slice(path.lastIndexOf('/') + 1);
	const SVG: Record<string, string> = Object.fromEntries(
		Object.entries(svgs).map(([p, s]) => [file(p), s.replace('<svg ', '<svg aria-hidden="true" focusable="false" ')])
	);
	const PNG: Record<string, string> = Object.fromEntries(Object.entries(pngs).map(([p, u]) => [file(p), u]));
</script>

<script lang="ts">
	import { BRANDS, type Brand, type BrandName } from '../brands.ts';

	let {
		name,
		size = 16,
		mono = false,
		label,
		class: cls = ''
	}: {
		name: BrandName;
		size?: number;
		/** Draw the mark in the surrounding text colour (dark surfaces such as the sidebar or a primary button). */
		mono?: boolean;
		/** Accessible name; leave empty when the brand is already written next to the mark. */
		label?: string;
		class?: string;
	} = $props();

	const brand: Brand = $derived(BRANDS[name]);
	const svg = $derived(SVG[brand.file]);
</script>

<span
	class="brand-icon {cls}"
	style="--brand: {brand.hex}; width: {size}px; height: {size}px"
	data-mono={mono || undefined}
	data-dark={mono ? undefined : brand.dark}
	role={label ? 'img' : undefined}
	aria-label={label || undefined}
	aria-hidden={label ? undefined : 'true'}
>
	{#if svg}
		<!-- Trusted, vendored file from src/lib/assets/brands. -->
		{@html svg}
	{:else}
		<img src={PNG[brand.file]} alt="" width={size} height={size} draggable="false" />
	{/if}
</span>
