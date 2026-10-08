<script lang="ts" generics="T">
	import { untrack, type Snippet } from 'svelte';
	import Empty from './Empty.svelte';
	import type { Column } from './table';

	let {
		rows,
		columns,
		row,
		search,
		toolbar,
		empty = 'Nic tu není.',
		pageSize = 50,
		initialSort
	}: {
		rows: T[];
		columns: Column<T>[];
		row: Snippet<[T]>;
		/** Text a row is matched against by the search box; no box when omitted. */
		search?: (row: T) => string;
		toolbar?: Snippet;
		empty?: string;
		pageSize?: number;
		initialSort?: { column: number; dir: 'asc' | 'desc' };
	} = $props();

	let query = $state('');
	let sortCol = $state<number | null>(untrack(() => initialSort?.column ?? null));
	let sortDir = $state<'asc' | 'desc'>(untrack(() => initialSort?.dir ?? 'asc'));
	let page = $state(0);

	const collator = new Intl.Collator('cs', { numeric: true, sensitivity: 'base' });
	const fold = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

	const filtered = $derived.by(() => {
		const q = fold(query.trim());
		let out = q && search ? rows.filter((r) => fold(search(r)).includes(q)) : rows;
		const accessor = sortCol == null ? undefined : columns[sortCol]?.sort;
		if (accessor) {
			const dir = sortDir === 'asc' ? 1 : -1;
			out = [...out].sort((a, b) => {
				const x = accessor(a),
					y = accessor(b);
				if (x == null) return 1;
				if (y == null) return -1;
				return (typeof x === 'number' && typeof y === 'number' ? x - y : collator.compare(String(x), String(y))) * dir;
			});
		}
		return out;
	});
	const pages = $derived(Math.max(1, Math.ceil(filtered.length / pageSize)));
	const visible = $derived(filtered.slice(page * pageSize, (page + 1) * pageSize));

	$effect(() => {
		query;
		page = 0;
	});

	function toggle(i: number) {
		if (sortCol === i) sortDir = sortDir === 'asc' ? 'desc' : 'asc';
		else {
			sortCol = i;
			sortDir = 'asc';
		}
	}
</script>

<div class="overflow-hidden rounded-[6px] border border-line bg-surface">
	{#if search || toolbar}
		<div class="flex flex-wrap items-center gap-2 border-b border-line p-2">
			{#if search}
				<input
					class="input max-w-72"
					type="search"
					placeholder="Hledat"
					aria-label="Hledat v tabulce"
					bind:value={query}
				/>
			{/if}
			{#if toolbar}{@render toolbar()}{/if}
			<span class="ml-auto pr-1 text-xs text-muted">{filtered.length} {filtered.length === 1 ? 'záznam' : 'záznamů'}</span>
		</div>
	{/if}
	{#if visible.length}
		<div class="overflow-x-auto">
			<table class="w-full border-collapse text-sm">
				<thead>
					<tr class="bg-surface-2 text-left">
						{#each columns as col, i (i)}
							<th
								scope="col"
								class="h-9 border-b border-line px-3 text-xs font-semibold whitespace-nowrap text-muted {col.align === 'right'
									? 'text-right'
									: ''} {col.class ?? ''}"
								aria-sort={sortCol === i ? (sortDir === 'asc' ? 'ascending' : 'descending') : undefined}
							>
								{#if col.sort}
									<button type="button" class="inline-flex items-center gap-1 hover:text-ink" onclick={() => toggle(i)}>
										{col.label}
										<span aria-hidden="true" class="text-[10px] {sortCol === i ? 'text-ink' : 'opacity-40'}">
											{sortCol === i && sortDir === 'desc' ? '▼' : '▲'}
										</span>
									</button>
								{:else}
									{col.label}
								{/if}
							</th>
						{/each}
					</tr>
				</thead>
				<tbody class="[&_td]:h-11 [&_td]:border-b [&_td]:border-line [&_td]:px-3 [&_tr:last-child_td]:border-b-0 [&_tr]:transition-colors [&_tr:hover]:bg-surface-2">
					{#each visible as r, i (i)}
						{@render row(r)}
					{/each}
				</tbody>
			</table>
		</div>
		{#if pages > 1}
			<div class="flex items-center justify-end gap-2 border-t border-line p-2 text-xs">
				<button class="rounded px-2 py-1 hover:bg-surface-2 disabled:opacity-40" disabled={page === 0} onclick={() => page--}>Předchozí</button>
				<span class="mono text-muted">{page + 1} / {pages}</span>
				<button class="rounded px-2 py-1 hover:bg-surface-2 disabled:opacity-40" disabled={page >= pages - 1} onclick={() => page++}>Další</button>
			</div>
		{/if}
	{:else}
		<Empty title={query ? 'Nic nenalezeno' : empty} />
	{/if}
</div>
