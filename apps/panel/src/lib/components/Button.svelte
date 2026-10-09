<script lang="ts">
	import type { HTMLButtonAttributes, HTMLAnchorAttributes } from 'svelte/elements';
	type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
	type Props = {
		variant?: Variant;
		size?: 'sm' | 'md';
		href?: string;
		children: import('svelte').Snippet;
	} & HTMLButtonAttributes &
		Omit<HTMLAnchorAttributes, keyof HTMLButtonAttributes>;
	let { variant = 'secondary', size = 'md', href, children, class: cls = '', ...rest }: Props = $props();
	const variants: Record<Variant, string> = {
		primary: 'bg-accent text-accent-ink border-accent hover:brightness-110',
		secondary: 'bg-surface text-ink border-line hover:bg-surface-2',
		ghost: 'bg-transparent text-ink border-transparent hover:bg-surface-2',
		danger: 'bg-surface text-bad border-line hover:bg-bad-bg'
	};
	const classes = $derived(
		`inline-flex items-center justify-center gap-1.5 rounded-[6px] border font-semibold whitespace-nowrap transition-[background,filter] disabled:opacity-50 disabled:pointer-events-none ${
			size === 'sm' ? 'h-7 px-2.5 text-xs' : 'h-[34px] px-3.5 text-sm'
		} ${variants[variant]} ${cls}`
	);
</script>

{#if href}
	<a {href} class={classes} {...rest as HTMLAnchorAttributes}>{@render children()}</a>
{:else}
	<button type="button" class={classes} {...rest}>{@render children()}</button>
{/if}
