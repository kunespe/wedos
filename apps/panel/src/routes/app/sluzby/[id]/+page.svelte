<script lang="ts">
	import { Check, MessageSquareWarning } from '@lucide/svelte';
	import Button from '#lib/components/Button.svelte';
	import Empty from '#lib/components/Empty.svelte';
	import PageHeader from '#lib/components/PageHeader.svelte';
	import Panel from '#lib/components/Panel.svelte';
	import Pill from '#lib/components/Pill.svelte';
	import { ago, czk, date, KIND_LABEL, periodTotal, SERVICE_STATUS_LABEL, TICKET_STATUS_LABEL } from '#lib/format.ts';
	import Health from '../../Health.svelte';
	import { expiryHint, expiryTone, SERVICE_TONE, TEXT_TONE, TICKET_TONE } from '../../tones.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const s = $derived(data.service);
	const tone = $derived(expiryTone(s.expiresAt));
</script>

<PageHeader title={s.label} crumbs={[{ href: '/app/sluzby', label: 'Služby' }]}>
	{#snippet meta()}
		<Pill tone={SERVICE_TONE[s.status]}>{SERVICE_STATUS_LABEL[s.status]}</Pill>
		<span>{KIND_LABEL[s.kind]}</span>
		{#if s.domain}<span class="mono text-xs">{s.domain}</span>{/if}
	{/snippet}
	{#snippet actions()}
		<Button href="/app/podpora/novy?sluzba={s.id}" variant="primary"><MessageSquareWarning size={15} />Nahlásit problém</Button>
	{/snippet}
</PageHeader>

{#if s.status === 'pending'}
	<div class="mb-5 rounded-[6px] border border-line bg-info-bg px-4 py-3 text-sm">
		<div class="font-bold">Službu právě zřizujeme</div>
		<p class="mt-0.5 text-muted">Nastavuje ji náš technik ručně. Přístupy vám pošleme e-mailem, jakmile bude vše připravené.</p>
	</div>
{:else if s.status === 'suspended'}
	<div class="mb-5 rounded-[6px] border border-line bg-warn-bg px-4 py-3 text-sm text-warn">
		<div class="font-bold">Služba je pozastavená</div>
		<p class="mt-0.5">Nejčastěji kvůli neuhrazené faktuře. Napište nám a vyřešíme to.</p>
	</div>
{/if}

<div class="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
	<div class="flex min-w-0 flex-col gap-5">
		<Panel title="Tarif">
			<div class="flex flex-wrap items-baseline justify-between gap-3">
				<div>
					<div class="text-lg font-bold">{data.plan?.name ?? KIND_LABEL[s.kind]}</div>
					<div class="text-sm text-muted">{s.period === 'year' ? 'Platba ročně' : 'Platba měsíčně'}</div>
				</div>
				<div class="text-right">
					<div class="mono text-lg">{s.priceMonthly == null ? 'Individuálně' : czk(periodTotal(s.priceMonthly, s.period))}</div>
					<div class="text-xs text-muted">
						{s.priceMonthly == null ? 'podle dohody' : s.period === 'year' ? 'za rok bez DPH' : 'za měsíc bez DPH'}
					</div>
				</div>
			</div>
			{#if data.plan?.features.length}
				<ul class="mt-4 grid gap-1.5 border-t border-line pt-3 text-sm sm:grid-cols-2">
					{#each data.plan.features as f (f)}
						<li class="flex items-start gap-2"><Check size={15} class="mt-0.5 shrink-0 text-ok" />{f}</li>
					{/each}
				</ul>
			{/if}
		</Panel>

		<Panel title="Dostupnost webu">
			{#if s.status === 'active'}
				<Health health={data.health} wide />
				<p class="mt-3 text-xs text-muted">Web hlídáme nepřetržitě. Když spadne, víme to dřív než vy. Tečka znamená, že data zatím nemáme.</p>
			{:else}
				<p class="text-sm text-muted">Monitoring začne po spuštění služby.</p>
			{/if}
		</Panel>

		<Panel title="Požadavky k této službě" flush>
			{#if data.related.length}
				<ul>
					{#each data.related as t (t.id)}
						<li class="border-b border-line last:border-b-0">
							<a href="/app/podpora/{t.id}" class="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-2">
								<span class="mono w-10 shrink-0 text-xs text-muted">#{t.id}</span>
								<span class="min-w-0 flex-1 truncate font-semibold">{t.subject}</span>
								<span class="hidden text-xs text-muted sm:block">{ago(t.updatedAt)}</span>
								<Pill tone={TICKET_TONE[t.status]}>{TICKET_STATUS_LABEL[t.status]}</Pill>
							</a>
						</li>
					{/each}
				</ul>
			{:else}
				<Empty title="Žádné požadavky" />
			{/if}
		</Panel>
	</div>

	<div class="flex min-w-0 flex-col gap-5">
		<Panel title="Údaje">
			<dl class="grid grid-cols-[110px_1fr] gap-x-3 gap-y-2 text-sm">
				<dt class="text-muted">Stav</dt>
				<dd>{SERVICE_STATUS_LABEL[s.status]}</dd>
				<dt class="text-muted">Typ</dt>
				<dd>{KIND_LABEL[s.kind]}</dd>
				<dt class="text-muted">Doména</dt>
				<dd class="mono min-w-0 text-xs break-all">{s.domain || '·'}</dd>
				<dt class="text-muted">Platí do</dt>
				<dd>
					<span class="mono text-xs">{date(s.expiresAt)}</span>
					{#if s.expiresAt}<span class="ml-1 text-xs {TEXT_TONE[tone]}">{expiryHint(s.expiresAt)}</span>{/if}
				</dd>
				<dt class="text-muted">Od</dt>
				<dd class="mono text-xs">{date(s.createdAt)}</dd>
			</dl>
			<p class="mt-4 border-t border-line pt-3 text-xs text-muted">
				Prodloužení řešíme sami: před koncem období vám přijde faktura e-mailem. Změnu tarifu nebo zrušení nám napište.
			</p>
		</Panel>
	</div>
</div>
