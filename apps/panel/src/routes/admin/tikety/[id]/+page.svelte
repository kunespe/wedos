<script lang="ts">
	import { enhance } from '$app/forms';
	import { keepResult } from '#lib/forms.ts';
	import Button from '#lib/components/Button.svelte';
	import CategoryChip from '#lib/components/CategoryChip.svelte';
	import RequestDetails from '#lib/components/RequestDetails.svelte';
	import FormMessage from '#lib/components/FormMessage.svelte';
	import PageHeader from '#lib/components/PageHeader.svelte';
	import Panel from '#lib/components/Panel.svelte';
	import { dateTime } from '#lib/format.ts';
	import TicketStatus from '../TicketStatus.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const t = $derived(data.ticket);
	let internal = $state(false);
</script>

<PageHeader title={t.subject} crumbs={[{ href: '/admin/tikety', label: 'Podpora' }, { href: `/admin/zakaznici/${data.customer.id}`, label: data.customer.company || data.customer.name }]}>
	{#snippet meta()}
		<TicketStatus status={t.status} />
		<CategoryChip category={t.category} />
		<span class="mono text-xs">#{t.id}</span>
		{#if data.service}<a class="underline" href="/admin/sluzby/{data.service.id}">{data.service.label}</a>{/if}
	{/snippet}
	{#snippet actions()}
		<form method="POST" action="?/status" use:enhance={keepResult()}>
			<input type="hidden" name="status" value={t.status === 'closed' ? 'open' : 'closed'} />
			<Button type="submit" size="sm">{t.status === 'closed' ? 'Znovu otevřít' : 'Uzavřít'}</Button>
		</form>
	{/snippet}
</PageHeader>

<FormMessage {form} />

<div class="grid max-w-5xl gap-5">
	{#if t.details && Object.keys(t.details).length}
		<Panel title="Údaje požadavku">
			<RequestDetails details={t.details} copy />
		</Panel>
	{/if}

	<ol class="flex flex-col gap-3">
		{#each data.messages as m (m.id)}
			{@const staff = m.role === 'admin'}
			<li class="rounded-[6px] border p-4 {m.internal ? 'border-amber/50 bg-warn-bg' : staff ? 'border-line bg-surface' : 'border-line bg-surface-2'}">
				<div class="mb-1.5 flex flex-wrap items-center gap-2 text-xs text-muted">
					<span class="font-semibold text-ink">{m.author ?? data.customer.name}</span>
					<span>{staff ? 'SERVEROS' : 'zákazník'}</span>
					{#if m.internal}<span class="mono font-semibold text-warn">INTERNÍ</span>{/if}
					<span class="ml-auto">{dateTime(m.createdAt)}</span>
				</div>
				<p class="text-sm whitespace-pre-wrap">{m.body}</p>
			</li>
		{/each}
	</ol>

	<Panel title={internal ? 'Interní poznámka' : 'Odpověď zákazníkovi'}>
		<form method="POST" action="?/reply" use:enhance={keepResult({ reset: true })} class="flex flex-col gap-3">
			<label class="sr-only" for="reply">Zpráva</label>
			<textarea id="reply" name="body" class="input min-h-32" required placeholder={internal ? 'Vidí jen správci' : 'Zákazník dostane e-mail a uvidí ji v klientské zóně'}></textarea>
			<div class="flex flex-wrap items-center justify-between gap-3">
				<label class="flex items-center gap-2 text-sm"><input type="checkbox" name="internal" bind:checked={internal} class="size-4" /> Jen interní poznámka</label>
				<div class="flex flex-wrap gap-2">
					{#if !internal && t.status !== 'closed'}
						<Button type="submit" formaction="?/done">Hotovo, odpovědět a uzavřít</Button>
					{/if}
					<Button type="submit" variant="primary">{internal ? 'Uložit poznámku' : 'Odeslat odpověď'}</Button>
				</div>
			</div>
		</form>
	</Panel>
</div>
