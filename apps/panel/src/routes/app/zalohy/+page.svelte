<script lang="ts">
	import Button from '#lib/components/Button.svelte';
	import Led from '#lib/components/Led.svelte';
	import PageHeader from '#lib/components/PageHeader.svelte';
	import Panel from '#lib/components/Panel.svelte';
</script>

<PageHeader title="Zálohy">
	{#snippet meta()}Připravujeme.{/snippet}
</PageHeader>

<div class="max-w-2xl">
	<Panel>
		<div class="flex items-start gap-3">
			<Led state="act" pulse />
			<div class="text-sm">
				<p class="font-semibold">Zálohy do cloudu spouštíme brzy</p>
				<p class="mt-1 text-muted">
					Každou noc zálohujeme weby i databáze mimo náš server, do šifrovaného úložiště v AWS. Tady pak uvidíte seznam záloh
					a jedním požadavkem si vyžádáte obnovu k vybranému dni.
				</p>
				<p class="mt-3 text-muted">Potřebujete obnovu nebo kopii dat teď? Napište nám, vyřešíme to ručně.</p>
				<div class="mt-4"><Button href="/app/podpora/novy?typ=restore" variant="primary">Požádat o obnovu</Button></div>
			</div>
		</div>
	</Panel>
</div>
