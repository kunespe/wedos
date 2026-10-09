<script lang="ts">
	import { Command, Dialog } from 'bits-ui';
	import { goto } from '$app/navigation';
	import type { NavGroup } from './nav';

	type Hit = { href: string; label: string; hint: string };
	let { groups, searchUrl }: { groups: NavGroup[]; searchUrl?: string } = $props();

	let open = $state(false);
	let value = $state('');
	let hits = $state<Hit[]>([]);
	let timer: ReturnType<typeof setTimeout> | undefined;

	export function show() {
		open = true;
	}

	function onkeydown(e: KeyboardEvent) {
		if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
			e.preventDefault();
			open = !open;
		}
	}

	$effect(() => {
		const q = value.trim();
		clearTimeout(timer);
		if (!searchUrl || q.length < 2) {
			hits = [];
			return;
		}
		timer = setTimeout(async () => {
			const res = await fetch(`${searchUrl}?q=${encodeURIComponent(q)}`);
			if (res.ok) hits = (await res.json()) as Hit[];
		}, 150);
	});

	function go(href: string) {
		open = false;
		value = '';
		goto(href);
	}
</script>

<svelte:window {onkeydown} />

<Dialog.Root bind:open>
	<Dialog.Portal>
		<Dialog.Overlay class="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px]" />
		<Dialog.Content
			class="fixed top-[12vh] left-1/2 z-50 w-[min(560px,calc(100vw-32px))] -translate-x-1/2 overflow-hidden rounded-[8px] border border-line bg-surface shadow-2xl"
		>
			<Dialog.Title class="sr-only">Rychlé hledání</Dialog.Title>
			<Command.Root shouldFilter={true} class="flex flex-col">
				<Command.Input
					bind:value
					placeholder="Přejít na stránku, hledat zákazníka, doménu, objednávku"
					class="h-12 w-full border-b border-line bg-transparent px-4 text-[15px] outline-none placeholder:text-muted"
				/>
				<Command.List class="max-h-[50vh] overflow-y-auto p-1.5">
					<Command.Viewport>
						<Command.Empty class="px-3 py-6 text-center text-sm text-muted">Nic nenalezeno.</Command.Empty>
						{#if hits.length}
							<Command.Group>
								<Command.GroupHeading class="px-2.5 pt-2 pb-1 text-xs font-semibold text-muted">Výsledky</Command.GroupHeading>
								<Command.GroupItems>
									{#each hits as h (h.href)}
										<Command.Item
											value={h.label + ' ' + h.hint}
											onSelect={() => go(h.href)}
											class="flex cursor-pointer items-center justify-between gap-3 rounded-[5px] px-2.5 py-2 text-sm data-selected:bg-surface-2"
										>
											<span class="truncate">{h.label}</span>
											<span class="mono shrink-0 text-xs text-muted">{h.hint}</span>
										</Command.Item>
									{/each}
								</Command.GroupItems>
							</Command.Group>
						{/if}
						{#each groups as g, gi (gi)}
							<Command.Group>
								<Command.GroupHeading class="px-2.5 pt-2 pb-1 text-xs font-semibold text-muted">{g.label ?? 'Stránky'}</Command.GroupHeading>
								<Command.GroupItems>
									{#each g.items as item (item.href)}
										{@const Icon = item.icon}
										<Command.Item
											value={item.label}
											onSelect={() => go(item.href)}
											class="flex cursor-pointer items-center gap-2.5 rounded-[5px] px-2.5 py-2 text-sm data-selected:bg-surface-2"
										>
											<Icon size={16} strokeWidth={1.75} class="text-muted" />
											{item.label}
										</Command.Item>
									{/each}
								</Command.GroupItems>
							</Command.Group>
						{/each}
					</Command.Viewport>
				</Command.List>
			</Command.Root>
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>
