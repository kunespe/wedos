<script lang="ts">
	import { enhance } from '$app/forms';
	import { Plus, Trash2, Wand } from '@lucide/svelte';
	import Button from '#lib/components/Button.svelte';
	import Panel from '#lib/components/Panel.svelte';
	import { CLIENT_INFO_LIMITS, looksSecret, presetRows, type InfoRow } from '#lib/client-info.ts';
	import type { ServiceKind } from '#lib/constants.ts';
	import { keepResult } from '#lib/forms.ts';

	let { kind, domain, rows: saved }: { kind: ServiceKind; domain: string; rows: InfoRow[] } = $props();

	// svelte-ignore state_referenced_locally
	let rows = $state<InfoRow[]>(saved.length ? saved.map((r) => ({ ...r })) : []);
	let busy = $state(false);

	function prefill() {
		const have = new Set(rows.map((r) => r.label.trim().toLowerCase()));
		const add = presetRows(kind, domain).filter((r) => !have.has(r.label.toLowerCase()));
		rows = [...rows.filter((r) => r.label || r.value), ...add].slice(0, CLIENT_INFO_LIMITS.rows);
	}
	const add = () => rows.length < CLIENT_INFO_LIMITS.rows && rows.push({ label: '', value: '' });
	const remove = (i: number) => rows.splice(i, 1);
</script>

<Panel title="Přístupové údaje pro zákazníka">
	{#snippet actions()}
		<Button size="sm" onclick={prefill} disabled={rows.length >= CLIENT_INFO_LIMITS.rows}><Wand size={14} />Předvyplnit podle typu</Button>
	{/snippet}
	<p class="mb-3 text-xs text-muted">
		Zákazník je uvidí v detailu služby v panelu „Připojení“ s tlačítkem pro kopírování. Hesla sem nikdy nepište: neukládáme je, zákazník si nové vyžádá požadavkem Přístup.
	</p>
	<form
		method="POST"
		action="?/clientInfo"
		use:enhance={(input) => {
			busy = true;
			return keepResult({ onDone: () => (busy = false) })(input);
		}}
	>
		{#if rows.length}
			<div class="hidden grid-cols-[minmax(0,220px)_minmax(0,1fr)_34px] gap-2 pb-1 text-xs font-semibold text-muted sm:grid">
				<span>Popisek</span><span>Hodnota</span><span></span>
			</div>
			<ul class="flex flex-col">
				{#each rows as row, i (i)}
					{@const secret = looksSecret(row.label)}
					<li class="grid grid-cols-[minmax(0,1fr)_34px] gap-2 border-b border-line py-2 last:border-b-0 sm:grid-cols-[minmax(0,220px)_minmax(0,1fr)_34px] sm:border-b-0 sm:py-1">
						<input
							class="input"
							name="infoLabel"
							aria-label="Popisek řádku {i + 1}"
							maxlength={CLIENT_INFO_LIMITS.label}
							placeholder="SFTP host"
							bind:value={row.label}
							aria-invalid={secret ? 'true' : undefined}
						/>
						<input
							class="input mono col-start-1 sm:col-start-auto"
							name="infoValue"
							aria-label="Hodnota řádku {i + 1}"
							maxlength={CLIENT_INFO_LIMITS.value}
							placeholder="vyplňte"
							bind:value={row.value}
							autocomplete="off"
						/>
						<button
							type="button"
							class="col-start-2 row-span-2 row-start-1 grid size-[34px] place-items-center rounded-[6px] border border-line text-muted hover:bg-bad-bg hover:text-bad sm:col-start-auto sm:row-span-1 sm:row-start-auto"
							aria-label="Odebrat řádek {i + 1}"
							onclick={() => remove(i)}><Trash2 size={15} /></button
						>
						{#if secret}
							<p class="col-span-full text-xs font-medium text-bad">Hesla a jiná tajemství sem nepatří. Tento řádek uložit nepůjde.</p>
						{/if}
					</li>
				{/each}
			</ul>
		{:else}
			<p class="rounded-[6px] bg-surface-2 px-3 py-3 text-sm text-muted">Zatím žádné údaje. Začněte předvyplněním podle typu služby.</p>
		{/if}
		<div class="mt-3 flex flex-wrap items-center justify-between gap-2">
			<Button size="sm" variant="ghost" onclick={add} disabled={rows.length >= CLIENT_INFO_LIMITS.rows}><Plus size={14} />Přidat řádek</Button>
			<span class="flex items-center gap-3">
				<span class="mono text-xs text-muted">{rows.length}/{CLIENT_INFO_LIMITS.rows}</span>
				<Button type="submit" variant="primary" disabled={busy}>{busy ? 'Ukládám' : 'Uložit údaje'}</Button>
			</span>
		</div>
	</form>
</Panel>
