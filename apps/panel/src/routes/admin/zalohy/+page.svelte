<script lang="ts">
	import { CircleCheck, TriangleAlert } from '@lucide/svelte';
	import BrokerDown from '#lib/components/BrokerDown.svelte';
	import DataTable from '#lib/components/DataTable.svelte';
	import PageHeader from '#lib/components/PageHeader.svelte';
	import Panel from '#lib/components/Panel.svelte';
	import Pill from '#lib/components/Pill.svelte';
	import Stat from '#lib/components/Stat.svelte';
	import type { Column } from '#lib/components/table.ts';
	import { ago, bytes, dateTime } from '#lib/format.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	type Backup = NonNullable<typeof data.backups>[number];

	const columns: Column<Backup>[] = [
		{ label: 'Web', sort: (r) => r.domain },
		{ label: 'Záloha', sort: (r) => r.name },
		{ label: 'Úložiště', sort: (r) => r.storage },
		{ label: 'Velikost', sort: (r) => r.size, align: 'right' },
		{ label: 'Vytvořeno', sort: (r) => r.time },
		{ label: 'Výsledek', sort: (r) => (r.success ? 1 : 0) }
	];
	const failed = $derived(data.backups?.filter((b) => !b.success).length ?? 0);
	const total = $derived(data.backups?.reduce((n, b) => n + b.size, 0) ?? 0);
</script>

<PageHeader title="Zálohy">
	{#snippet meta()}Zálohy WordPressů, které vznikají před každou aktualizací.{/snippet}
</PageHeader>

{#if !data.backups}
	<BrokerDown error={data.error} enabled={data.enabled} />
{:else}
	<div
		class="mb-5 flex gap-3 rounded-[6px] border p-4 text-sm {data.s3Ready ? 'border-ok/30 bg-ok-bg' : 'border-warn/40 bg-warn-bg'}"
		role="status"
	>
		{#if data.s3Ready}
			<CircleCheck size={18} class="mt-0.5 shrink-0 text-ok" />
			<p><span class="font-bold text-ok">S3 je připojené a ověřené.</span> Zálohy jsou šifrované (Restic) a před aktualizací se ověřují zpětným stažením.</p>
		{:else}
			<TriangleAlert size={18} class="mt-0.5 shrink-0 text-warn" />
			<p>
				<span class="font-bold text-warn">S3 zatím není připojené.</span> Zálohy níže leží jen na disku serveru a při ztrátě serveru nepomohou. Aktualizace
				WordPressů čekají, dokud nebude externí úložiště ověřené.
			</p>
		{/if}
	</div>

	<div class="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
		<Stat label="Záloh" value={data.backups.length} />
		<Stat label="Vyžaduje kontrolu" value={failed} hint="aktualizace po záloze nedoběhla" />
		<Stat label="Místo na disku" value={bytes(total)} hint="součet velikostí v seznamu" />
		<Stat label="Externí úložiště" value={data.s3Ready ? 'S3' : 'Žádné'} />
	</div>

	<DataTable
		rows={data.backups}
		{columns}
		search={(r) => `${r.domain} ${r.name} ${r.path} ${r.storage}`}
		empty="První záloha vznikne před první aktualizací."
		initialSort={{ column: 4, dir: 'desc' }}
	>
		{#snippet row(b)}
			<tr>
				<td>
					<div class="font-semibold">{b.domain}</div>
					<div class="mono max-w-64 truncate text-[11px] text-muted" title={b.path}>{b.path}</div>
				</td>
				<td class="mono text-xs">
					{b.name}
					{#if b.snapshot}<div class="text-[11px] text-muted">snapshot {b.snapshot.slice(0, 8)}</div>{/if}
				</td>
				<td><Pill tone={b.storage === 'S3' ? 'ok' : 'off'}>{b.storage}</Pill></td>
				<td class="mono text-right text-xs whitespace-nowrap">{bytes(b.size)}</td>
				<td class="text-xs whitespace-nowrap" title={ago(b.time)}>{dateTime(b.time)}</td>
				<td>{#if b.success}<Pill tone="ok">Úspěšná</Pill>{:else}<Pill tone="bad">Vyžaduje kontrolu</Pill>{/if}</td>
			</tr>
		{/snippet}
	</DataTable>
{/if}

<div class="mt-5 grid gap-5 [&>*]:min-w-0 lg:grid-cols-2">
	<Panel title="Jak zálohy vznikají">
		<ol class="flex list-decimal flex-col gap-1.5 pl-5 text-sm">
			<li>Údržba WordPressu (denně kolem 03:30) před aktualizací exportuje databázi a zabalí soubory webu.</li>
			<li>Archiv se zkontroluje a prázdný export databáze zálohu zneplatní.</li>
			<li>Je potřeba volné místo aspoň 5 GB a trojnásobek velikosti webu, jinak se web přeskočí.</li>
			<li>S připojeným S3 se záloha šifrovaně nahraje, znovu stáhne a porovná SHA-256 obou archivů. Teprve pak proběhne aktualizace.</li>
			<li>Úspěšná aktualizace označí zálohu jako úspěšnou. Při chybě zůstává záloha označená „Vyžaduje kontrolu“ pro ruční obnovu.</li>
		</ol>
	</Panel>
	<Panel title="Retence a obnova">
		<ul class="flex flex-col gap-1.5 text-sm">
			<li><span class="font-semibold">S3:</span> poslední 2 úspěšné zálohy každého webu (minimum 2), starší se promažou. Lokální kopie archivů se po ověření v S3 smažou.</li>
			<li><span class="font-semibold">Disk serveru:</span> poslední 2 úspěšné zálohy každého webu, starší úspěšné se mažou.</li>
			<li><span class="font-semibold">Neúspěšné aktualizace:</span> jejich zálohy se nikdy automaticky nemažou.</li>
			<li>
				<span class="font-semibold">Obnova:</span> ručně správcem přes SSH; <span class="mono">vytvorit-web-s3 restore</span> stáhne archiv do nového adresáře,
				import databáze a nahrazení webu jsou samostatný krok. Automatický rollback zatím není.
			</li>
		</ul>
	</Panel>
</div>
