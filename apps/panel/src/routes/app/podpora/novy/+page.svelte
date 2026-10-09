<script lang="ts">
	import { page } from '$app/state';
	import { ChevronRight } from '@lucide/svelte';
	import FormMessage from '#lib/components/FormMessage.svelte';
	import PageHeader from '#lib/components/PageHeader.svelte';
	import Panel from '#lib/components/Panel.svelte';
	import { REQUEST_LIST, REQUESTS } from '#lib/requests.ts';
	import Contact from '../../Contact.svelte';
	import { REQUEST_ICON } from '../../request-icons.ts';
	import RequestForm from './RequestForm.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	// A failed submit keeps the chosen category even if the URL did not carry it.
	const category = $derived(form?.category ?? data.category);
	const def = $derived(category ? REQUESTS[category] : null);

	const hrefFor = (key: string) => {
		const q = new URLSearchParams({ typ: key });
		const s = page.url.searchParams.get('sluzba');
		if (s) q.set('sluzba', s);
		return `?${q}`;
	};
	const Icon = $derived(def ? REQUEST_ICON[def.key] : null);
</script>

<PageHeader title={def ? def.label : 'Nový požadavek'} crumbs={[{ href: '/app/podpora', label: 'Podpora' }, ...(def ? [{ href: '/app/podpora/novy', label: 'Nový požadavek' }] : [])]}>
	{#snippet meta()}
		{#if def}{def.description}{:else}Vyberte, co potřebujete. Každý požadavek vyřizuje člověk, v pracovní době do pár hodin.{/if}
	{/snippet}
</PageHeader>

<div class="grid gap-5 xl:grid-cols-[1fr_300px]">
	<div class="min-w-0">
		{#if def && Icon}
			<Panel class="min-w-0">
				<div class="mb-4 flex items-center gap-3 border-b border-line pb-4">
					<span class="grid size-9 shrink-0 place-items-center rounded-[6px] {def.urgent ? 'bg-bad-bg text-bad' : 'bg-info-bg text-accent'}"><Icon size={18} /></span>
					<div class="min-w-0 flex-1 text-sm">
						<div class="font-bold">{def.label}</div>
						<div class="text-muted">{def.urgent ? 'Řešíme přednostně.' : 'Vyplňte údaje, zbytek zařídíme ručně.'}</div>
					</div>
					<a href="/app/podpora/novy{page.url.searchParams.get('sluzba') ? `?sluzba=${page.url.searchParams.get('sluzba')}` : ''}" class="shrink-0 text-xs font-semibold text-accent hover:underline">Změnit typ</a>
				</div>
				<FormMessage {form} />
				{#key category}
					<RequestForm {def} {data} {form} />
				{/key}
			</Panel>
		{:else}
			<FormMessage {form} />
			<ul class="grid gap-3 sm:grid-cols-2" aria-label="Typy požadavků">
				{#each REQUEST_LIST as r (r.key)}
					{@const CardIcon = REQUEST_ICON[r.key]}
					<li class="min-w-0">
						<a
							href={hrefFor(r.key)}
							class="group flex h-full items-start gap-3 rounded-[6px] border p-4 transition-colors hover:bg-surface-2 {r.urgent ? 'border-bad/40 bg-surface' : 'border-line bg-surface'}"
						>
							<span class="grid size-9 shrink-0 place-items-center rounded-[6px] {r.urgent ? 'bg-bad-bg text-bad' : 'bg-info-bg text-accent'}"><CardIcon size={18} /></span>
							<span class="min-w-0 flex-1">
								<span class="block font-bold">{r.label}</span>
								<span class="mt-0.5 block text-xs text-muted">{r.description}</span>
							</span>
							<ChevronRight size={16} class="mt-1 shrink-0 text-muted transition-transform group-hover:translate-x-0.5" />
						</a>
					</li>
				{/each}
			</ul>
		{/if}
	</div>

	<div class="min-w-0">
		<Contact cta={false} />
		<p class="mt-3 px-1 text-xs text-muted">Když web úplně nejde, raději rovnou zavolejte. Hesla nám nikdy neposílejte.</p>
	</div>
</div>
