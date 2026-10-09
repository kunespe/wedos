<script lang="ts">
	import { enhance } from '$app/forms';
	import Button from '#lib/components/Button.svelte';
	import CategoryChip from '#lib/components/CategoryChip.svelte';
	import RequestDetails from '#lib/components/RequestDetails.svelte';
	import FormMessage from '#lib/components/FormMessage.svelte';
	import PageHeader from '#lib/components/PageHeader.svelte';
	import Pill from '#lib/components/Pill.svelte';
	import { ago, dateTime, TICKET_STATUS_LABEL } from '#lib/format.ts';
	import { keepResult } from '#lib/forms.ts';
	import { TICKET_TONE } from '../../tones.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const t = $derived(data.ticket);
	let busy = $state(false);

	const initials = (name: string) =>
		name
			.split(' ')
			.map((p) => p[0])
			.slice(0, 2)
			.join('');
</script>

<PageHeader title={t.subject} crumbs={[{ href: '/app/podpora', label: 'Podpora' }]}>
	{#snippet meta()}
		<span class="mono text-xs">#{t.id}</span>
		<Pill tone={TICKET_TONE[t.status]}>{TICKET_STATUS_LABEL[t.status]}</Pill>
		{#if t.category !== 'general'}<CategoryChip category={t.category} />{/if}
		<span title={dateTime(t.createdAt)}>založeno {ago(t.createdAt)}</span>
		{#if data.service}<a class="underline" href="/app/sluzby/{data.service.id}">{data.service.label}</a>{/if}
	{/snippet}
	{#snippet actions()}
		{#if t.status !== 'closed'}
			<form method="POST" action="?/close" use:enhance={keepResult()}>
				<Button type="submit" size="sm">Uzavřít požadavek</Button>
			</form>
		{/if}
	{/snippet}
</PageHeader>

{#if data.created && !form}
	<div role="status" class="mb-4 rounded-[6px] border border-ok/30 bg-ok-bg px-3 py-2 text-sm font-medium text-ok">
		Požadavek jsme přijali. Ozveme se v pracovní době do pár hodin, odpověď uvidíte tady i v e-mailu.
	</div>
{/if}
<FormMessage {form} />

<div class="mx-auto flex max-w-[860px] flex-col gap-3">
	{#if t.details && Object.keys(t.details).length}
		<section class="rounded-[6px] border border-line bg-surface px-4 py-2" aria-label="Údaje požadavku">
			<h2 class="pt-1 pb-1 text-xs font-bold text-muted">Údaje požadavku</h2>
			<RequestDetails details={t.details} />
		</section>
	{/if}
	<ol class="flex flex-col gap-3" aria-label="Konverzace">
		{#each data.messages as m (m.id)}
			{@const staff = m.authorRole === 'admin'}
			{@const name = m.authorName ?? 'Zákazník'}
			<li class="flex gap-3 {staff ? '' : 'flex-row-reverse'}">
				<div
					class="grid size-8 shrink-0 place-items-center rounded-full text-[11px] font-bold {staff ? 'bg-chassis-3 text-white' : 'bg-surface-2 text-muted'}"
					aria-hidden="true"
				>
					{staff ? 'S' : initials(name)}
				</div>
				<div class="min-w-0 max-w-[85%] flex-1 rounded-[6px] border px-4 py-3 {staff ? 'border-accent/25 bg-info-bg' : 'border-line bg-surface'}">
					<div class="mb-1 flex flex-wrap items-baseline justify-between gap-x-3 text-xs text-muted">
						<span class="font-semibold text-ink">{staff ? `${name} · SERVEROS` : m.mine ? `${name} (vy)` : name}</span>
						<span title={dateTime(m.createdAt)}>{dateTime(m.createdAt)}</span>
					</div>
					<p class="text-sm break-words whitespace-pre-wrap">{m.body}</p>
				</div>
			</li>
		{:else}
			<li class="text-sm text-muted">Zatím bez zpráv.</li>
		{/each}
	</ol>

	<form
		method="POST"
		action="?/reply"
		class="mt-2 flex flex-col gap-2 rounded-[6px] border border-line bg-surface p-3"
		use:enhance={(input) => {
			busy = true;
			return keepResult({ reset: true, onDone: () => (busy = false) })(input);
		}}
	>
		<label class="label" for="reply-body">{t.status === 'closed' ? 'Odpovědět a znovu otevřít' : 'Vaše odpověď'}</label>
		<textarea
			id="reply-body"
			name="body"
			class="input min-h-32"
			required
			maxlength={data.limits.body}
			value={form && 'body' in form ? (form.body ?? '') : ''}
			placeholder="Napište doplnění nebo odpověď"
		></textarea>
		<div class="flex items-center justify-between gap-2">
			<span class="text-xs text-muted">{t.status === 'waiting' ? 'Čekáme na vaši odpověď.' : ''}</span>
			<Button type="submit" variant="primary" disabled={busy}>{busy ? 'Odesílám' : 'Odeslat'}</Button>
		</div>
	</form>
</div>
