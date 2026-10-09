<script lang="ts">
	import { enhance } from '$app/forms';
	import { keepResult } from '#lib/forms.ts';
	import Button from '#lib/components/Button.svelte';
	import Empty from '#lib/components/Empty.svelte';
	import FormMessage from '#lib/components/FormMessage.svelte';
	import PageHeader from '#lib/components/PageHeader.svelte';
	import { czk, date, daysUntil, periodTotal } from '#lib/format.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const priced = $derived(data.services.filter((s) => s.priceMonthly != null));
	let selected = $state<number[]>([]);
	const all = $derived(priced.length > 0 && priced.every((s) => selected.includes(s.id)));
	const total = $derived(
		priced.filter((s) => selected.includes(s.id)).reduce((sum, s) => sum + periodTotal(s.priceMonthly!, s.period), 0)
	);

	// Drop selections of rows that disappeared after issuing.
	$effect(() => {
		const ids = new Set(priced.map((s) => s.id));
		if (selected.some((id) => !ids.has(id))) selected = selected.filter((id) => ids.has(id));
	});

	const issueLabel = $derived(
		!selected.length ? 'Vystavit výzvy' : `Vystavit ${selected.length} ${selected.length === 1 ? 'výzvu' : selected.length < 5 ? 'výzvy' : 'výzev'}`
	);

	function toggleAll() {
		selected = all ? [] : priced.map((s) => s.id);
	}
</script>

<PageHeader title="Výzvy k obnově" crumbs={[{ href: '/admin/platby', label: 'Platby' }]}>
	{#snippet meta()}Aktivní služby, kterým do {data.horizon} dní končí zaplacené období (nebo už skončilo) a nemají nezaplacenou výzvu. Služby v ručním držení tu nejsou.{/snippet}
</PageHeader>

<FormMessage {form} />

<form method="POST" action="?/issue" use:enhance={keepResult()} class="overflow-hidden rounded-[6px] border border-line bg-surface">
	{#if data.services.length}
		<div class="flex flex-wrap items-center gap-3 border-b border-line p-2 pl-3">
			<label class="flex items-center gap-2 text-sm font-semibold">
				<input type="checkbox" class="size-4" checked={all} onchange={toggleAll} disabled={!priced.length} />
				Vybrat vše
			</label>
			<span class="text-xs text-muted">{selected.length} vybráno{total ? `, celkem ${czk(total)} bez DPH` : ''}</span>
		</div>
		<ul>
			{#each data.services as s (s.id)}
				{@const d = daysUntil(s.expiresAt)}
				<li class="border-b border-line last:border-b-0">
					<label class="flex items-start gap-3 px-3 py-2.5 {s.priceMonthly == null ? 'opacity-60' : 'cursor-pointer hover:bg-surface-2'}">
						<input type="checkbox" name="service" value={s.id} bind:group={selected} disabled={s.priceMonthly == null} class="mt-0.5 size-4 shrink-0" />
						<span class="min-w-0 flex-1">
							<span class="block truncate font-semibold">{s.label}</span>
							<span class="block truncate text-xs text-muted">
								<a class="hover:underline" href="/admin/zakaznici/{s.customerId}">{s.company || s.customer}</a> · <a class="hover:underline" href="/admin/sluzby/{s.id}">detail služby</a>
							</span>
						</span>
						<span class="shrink-0 text-right text-xs">
							<span class="mono block">{s.priceMonthly == null ? 'bez ceny' : czk(periodTotal(s.priceMonthly, s.period))}</span>
							<span class="block text-muted">{s.period === 'year' ? 'rok' : 'měsíc'}</span>
						</span>
						<span class="w-24 shrink-0 text-right text-xs">
							<span class="mono block">{date(s.expiresAt)}</span>
							<span class="block {d != null && d < 0 ? 'text-bad' : 'text-warn'}">{d == null ? '' : d < 0 ? `${-d} dní po` : d === 0 ? 'dnes' : `za ${d} dní`}</span>
						</span>
					</label>
				</li>
			{/each}
		</ul>
		<div class="flex flex-wrap items-center justify-end gap-3 border-t border-line p-3">
			<label class="flex items-center gap-2 text-sm">
				<input type="checkbox" name="send" class="size-4" checked />
				Poslat zákazníkům e-mailem
			</label>
			<Button type="submit" variant="primary" disabled={!selected.length}>{issueLabel}</Button>
		</div>
	{:else}
		<Empty title="Nic k obnově">Žádné aktivní službě nekončí do {data.horizon} dní zaplacené období bez vystavené výzvy.</Empty>
	{/if}
</form>
