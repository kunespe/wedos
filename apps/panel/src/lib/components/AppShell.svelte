<script lang="ts">
	import type { Snippet } from 'svelte';
	import { page } from '$app/state';
	import { LogOut, Menu, Search, X } from '@lucide/svelte';
	import BrandIcon from './BrandIcon.svelte';
	import CommandPalette from './CommandPalette.svelte';
	import Led from './Led.svelte';
	import ThemeToggle from './ThemeToggle.svelte';
	import type { NavGroup } from './nav';

	let {
		groups,
		user,
		area,
		searchUrl,
		children
	}: {
		groups: NavGroup[];
		user: { name: string; email: string };
		area: string;
		searchUrl?: string;
		children: Snippet;
	} = $props();

	let drawer = $state(false);
	let palette = $state<CommandPalette>();

	const active = (href: string, exact?: boolean) =>
		exact ? page.url.pathname === href : page.url.pathname === href || page.url.pathname.startsWith(href + '/');

	$effect(() => {
		page.url.pathname;
		drawer = false;
	});
</script>

{#snippet nav()}
	<div class="flex h-14 shrink-0 items-center gap-2.5 px-4">
		<a href="/" class="flex items-center gap-2 font-extrabold tracking-[0.14em] text-white" style="font-variation-settings: 'wdth' 118">
			<span class="flex flex-col gap-[3px]" aria-hidden="true">
				<span class="flex h-[7px] w-5 items-center justify-end rounded-[2px] bg-chassis-2 pr-[3px]"><span class="size-[3px] rounded-full bg-led"></span></span>
				<span class="flex h-[7px] w-5 items-center justify-end rounded-[2px] bg-chassis-2 pr-[3px]"><span class="size-[3px] rounded-full bg-amber"></span></span>
			</span>
			SERVEROS
		</a>
		<span class="mono rounded-[4px] border border-white/15 px-1.5 py-px text-[10px] text-white/55">{area}</span>
	</div>

	<button
		type="button"
		onclick={() => palette?.show()}
		class="mx-3 mb-3 flex h-8 items-center gap-2 rounded-[6px] border border-white/10 bg-white/5 px-2.5 text-left text-xs text-white/55 hover:bg-white/10"
	>
		<Search size={14} />
		<span class="flex-1">Hledat</span>
		<span class="mono text-[10px] text-white/40">⌘K</span>
	</button>

	<nav class="flex-1 overflow-y-auto px-2 pb-4" aria-label="Hlavní navigace">
		{#each groups as g, gi (gi)}
			{#if g.label}
				<div class="mono px-2.5 pt-4 pb-1.5 text-[10px] tracking-[0.12em] text-white/35 uppercase">{g.label}</div>
			{/if}
			<ul class="flex flex-col gap-px">
				{#each g.items as item (item.href)}
					{@const Icon = item.icon}
					{@const on = active(item.href, item.exact)}
					<li>
						<a
							href={item.href}
							aria-current={on ? 'page' : undefined}
							class="flex h-8 items-center gap-2.5 rounded-[6px] px-2.5 text-[13px] font-medium transition-colors {on
								? 'bg-white/10 text-white'
								: 'text-white/65 hover:bg-white/5 hover:text-white'}"
						>
							{#if item.brand}<BrandIcon name={item.brand} mono />{:else}<Icon size={16} strokeWidth={1.75} />{/if}
							<span class="flex-1 truncate">{item.label}</span>
							{#if item.soon}
								<span class="mono rounded-[4px] border border-white/15 px-1.5 py-px text-[10px] text-white/50">brzy</span>
							{/if}
							{#if item.badge}
								<span class="mono flex items-center gap-1.5 text-[11px] text-white/80"><Led state="warn" />{item.badge}</span>
							{/if}
						</a>
					</li>
				{/each}
			</ul>
		{/each}
	</nav>

	<div class="flex items-center gap-2 border-t border-white/10 px-3 py-3">
		<div class="grid size-8 shrink-0 place-items-center rounded-full bg-chassis-2 text-xs font-bold text-white">
			{user.name.split(' ').map((p) => p[0]).slice(0, 2).join('')}
		</div>
		<div class="min-w-0 flex-1">
			<div class="truncate text-[13px] font-semibold text-white">{user.name}</div>
			<div class="truncate text-[11px] text-white/50">{user.email}</div>
		</div>
		<ThemeToggle />
		<form method="POST" action="/odhlaseni">
			<button
				type="submit"
				title="Odhlásit"
				aria-label="Odhlásit"
				class="grid size-8 place-items-center rounded-[6px] text-white/60 hover:bg-white/10 hover:text-white"
			>
				<LogOut size={16} />
			</button>
		</form>
	</div>
{/snippet}

<div class="min-h-dvh lg:grid lg:grid-cols-[240px_1fr] print:block print:min-h-0">
	<aside class="sticky top-0 hidden h-dvh flex-col bg-chassis-3 lg:flex print:hidden">{@render nav()}</aside>

	<div class="sticky top-0 z-30 flex h-12 items-center justify-between bg-chassis-3 px-3 lg:hidden print:hidden">
		<button type="button" class="grid size-9 place-items-center text-white" aria-label="Otevřít menu" onclick={() => (drawer = true)}>
			<Menu size={20} />
		</button>
		<span class="font-extrabold tracking-[0.14em] text-white" style="font-variation-settings: 'wdth' 118">SERVEROS</span>
		<button type="button" class="grid size-9 place-items-center text-white" aria-label="Hledat" onclick={() => palette?.show()}>
			<Search size={18} />
		</button>
	</div>

	{#if drawer}
		<div class="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
			<button type="button" class="absolute inset-0 bg-black/50" aria-label="Zavřít menu" onclick={() => (drawer = false)}></button>
			<aside class="relative flex h-full w-[280px] max-w-[85vw] flex-col bg-chassis-3">
				<button type="button" class="absolute top-3 right-3 grid size-8 place-items-center text-white/70" aria-label="Zavřít menu" onclick={() => (drawer = false)}>
					<X size={18} />
				</button>
				{@render nav()}
			</aside>
		</div>
	{/if}

	<main class="min-w-0 px-4 py-6 sm:px-6 lg:px-8 lg:py-8 print:p-0">
		<div class="mx-auto max-w-[1280px]">{@render children()}</div>
	</main>
</div>

<CommandPalette bind:this={palette} {groups} {searchUrl} />
