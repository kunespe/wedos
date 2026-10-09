<script lang="ts">
	import type { Snippet } from 'svelte';
	let { title, lead, children }: { title: string; lead?: string; children: Snippet } = $props();
</script>

<svelte:head><title>{title} · SERVEROS</title></svelte:head>

<div class="grid min-h-dvh lg:grid-cols-[1fr_minmax(420px,520px)]">
	<!-- The rack face from the landing, reduced to a quiet backdrop. -->
	<div class="relative hidden overflow-hidden bg-chassis-3 lg:block" aria-hidden="true">
		<div class="absolute inset-0 flex flex-col justify-center gap-3 px-16">
			{#each Array(9) as _, i (i)}
				<div class="flex h-11 items-center gap-3 rounded-[4px] bg-chassis px-4" style="opacity: {1 - Math.abs(i - 4) * 0.16}">
					<span class="mono w-6 text-[10px] text-white/30">{String(9 - i).padStart(2, '0')}</span>
					<span class="h-1 flex-1 rounded-full bg-chassis-2"></span>
					{#each Array(6) as _, j (j)}
						<span class="h-5 w-3 rounded-[2px] bg-chassis-2"></span>
					{/each}
					<span class="size-1.5 rounded-full {i === 4 ? 'bg-amber' : 'bg-led'}"></span>
				</div>
			{/each}
		</div>
		<div class="absolute bottom-10 left-16 text-white">
			<div class="text-[44px] leading-none font-extrabold tracking-[0.12em]" style="font-variation-settings: 'wdth' 125">SERVEROS</div>
			<div class="mono mt-3 text-xs text-white/50">Klientská zóna a správa</div>
		</div>
	</div>
	<div class="flex items-center justify-center bg-bg px-4 py-10">
		<div class="w-full max-w-[380px]">
			<div class="mb-8 font-extrabold tracking-[0.14em] lg:hidden" style="font-variation-settings: 'wdth' 118">SERVEROS</div>
			<h1 class="text-[24px] font-extrabold tracking-[-0.01em]">{title}</h1>
			{#if lead}<p class="mt-1.5 text-sm text-muted">{lead}</p>{/if}
			<div class="mt-6">{@render children()}</div>
		</div>
	</div>
</div>
