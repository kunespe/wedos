<script lang="ts">
	// Calm placeholder for pages that need the root broker when it is disabled or not answering.
	import Empty from './Empty.svelte';
	import Panel from './Panel.svelte';
	let { error, enabled }: { error: string | null; enabled: boolean } = $props();
</script>

<Panel>
	<Empty title={enabled ? 'Provozní data se nepodařilo načíst' : 'Serverové operace jsou vypnuté'}>
		{#if enabled}
			{error ?? 'Provozní služba není dostupná.'} Obnovte stránku; pokud problém trvá, ověřte na serveru službu
			<span class="mono">vw-dashboard-broker</span>.
		{:else}
			V tomto prostředí není nastavený <span class="mono">BROKER_SOCKET</span>, takže panel nemá spojení s uzlem.
		{/if}
	</Empty>
</Panel>
