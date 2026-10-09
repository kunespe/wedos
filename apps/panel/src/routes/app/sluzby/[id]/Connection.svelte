<script lang="ts">
	import { ShieldCheck } from '@lucide/svelte';
	import CopyButton from '#lib/components/CopyButton.svelte';
	import Panel from '#lib/components/Panel.svelte';

	let { rows, pending }: { rows: { label: string; value: string }[]; pending: boolean } = $props();
</script>

<Panel title="Připojení" flush>
	{#if rows.length}
		<dl class="text-sm">
			{#each rows as r, i (i)}
				<div class="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line px-4 py-2.5">
					<dt class="w-full text-xs text-muted sm:w-36 sm:shrink-0">{r.label}</dt>
					<dd class="mono min-w-0 flex-1 text-xs break-all">{r.value}</dd>
					<dd class="shrink-0"><CopyButton value={r.value} /></dd>
				</div>
			{/each}
		</dl>
	{:else}
		<p class="border-b border-line px-4 py-3 text-sm text-muted">
			{pending ? 'Přístupové údaje sem doplníme, jakmile službu zřídíme.' : 'Údaje pro připojení tu zatím nemáme. Napište nám a doplníme je.'}
		</p>
	{/if}
	<p class="flex items-start gap-2 px-4 py-3 text-xs text-muted">
		<ShieldCheck size={15} class="mt-px shrink-0 text-ok" />
		<span>Hesla neposíláme e-mailem ani je neukládáme. Nové heslo si vyžádejte požadavkem <a class="font-semibold text-accent hover:underline" href="/app/podpora/novy?typ=access">Přístup</a>.</span>
	</p>
</Panel>
