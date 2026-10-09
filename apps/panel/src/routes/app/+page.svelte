<script lang="ts">
	import { Banknote, MessageSquarePlus, ShoppingCart, Wrench } from '@lucide/svelte';
	import Button from '#lib/components/Button.svelte';
	import Empty from '#lib/components/Empty.svelte';
	import Led from '#lib/components/Led.svelte';
	import PageHeader from '#lib/components/PageHeader.svelte';
	import Panel from '#lib/components/Panel.svelte';
	import Pill from '#lib/components/Pill.svelte';
	import ServiceKind from '#lib/components/ServiceKind.svelte';
	import { ago, czk, date, daysUntil, SERVICE_STATUS_LABEL, TICKET_STATUS_LABEL } from '#lib/format.ts';
	import Contact from './Contact.svelte';
	import Health from './Health.svelte';
	import { expiryHint, expiryTone, SERVICE_TONE, TEXT_TONE, TICKET_TONE } from './tones.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const greeting = $derived.by(() => {
		const h = Number(new Intl.DateTimeFormat('cs-CZ', { hour: 'numeric', timeZone: 'Europe/Prague' }).format(new Date()));
		return h < 10 ? 'Dobré ráno' : h < 18 ? 'Dobrý den' : 'Dobrý večer';
	});
	const pending = $derived(data.services.filter((s) => s.status === 'pending'));
	const unpaidTotal = $derived(data.unpaid.reduce((sum, p) => sum + p.amount, 0));
	const overdue = $derived(data.unpaid.some((p) => (daysUntil(p.dueDate) ?? 0) < 0));
</script>

<PageHeader title="{greeting}, {data.name.split(' ')[0]}">
	{#snippet meta()}Vaše služby, domény a požadavky na jednom místě.{/snippet}
	{#snippet actions()}
		<Button href="/app/podpora/novy"><MessageSquarePlus size={15} />Nový požadavek</Button>
		<Button href="/app/objednat" variant="primary"><ShoppingCart size={15} />Objednat službu</Button>
	{/snippet}
</PageHeader>

{#if data.unpaid.length}
	<div class="mb-5 flex flex-wrap items-center gap-3 rounded-[6px] border px-4 py-3 text-sm {overdue ? 'border-bad/40 bg-bad-bg' : 'border-warn/40 bg-warn-bg'}">
		<Banknote size={18} class="shrink-0 {overdue ? 'text-bad' : 'text-warn'}" />
		<div class="min-w-0 flex-1">
			<div class="font-bold">K úhradě {czk(unpaidTotal)}</div>
			<p class="mt-0.5 text-muted">
				{data.unpaid.length === 1 ? 'Máte jednu nezaplacenou výzvu' : `Máte ${data.unpaid.length} ${data.unpaid.length < 5 ? 'nezaplacené výzvy' : 'nezaplacených výzev'}`}, splatnost
				{date(data.unpaid[0].dueDate)}{overdue ? ' (už po splatnosti)' : ''}. Zaplatit můžete QR kódem v aplikaci banky.
			</p>
		</div>
		<Button href="/app/faktury" variant="primary">Zaplatit</Button>
	</div>
{/if}

{#if pending.length}
	<div class="mb-5 flex items-start gap-3 rounded-[6px] border border-line bg-info-bg px-4 py-3 text-sm">
		<Wrench size={18} class="mt-0.5 shrink-0 text-accent" />
		<div class="min-w-0">
			<div class="font-bold">Zřizujeme {pending.length === 1 ? 'vaši novou službu' : `${pending.length} nové služby`}</div>
			<p class="mt-0.5 text-muted">
				{pending.map((s) => s.label).join(', ')}. Nastavuje ji u nás konkrétní člověk, ne automat. Jakmile bude hotová, pošleme vám
				přístupy e-mailem. Kdybyste mezitím cokoli potřebovali, stačí napsat.
			</p>
		</div>
	</div>
{/if}

<div class="grid gap-5 xl:grid-cols-[1.6fr_1fr]">
	<div class="flex min-w-0 flex-col gap-5">
		<section aria-labelledby="sluzby-h">
			<div class="mb-2 flex items-center justify-between">
				<h2 id="sluzby-h" class="text-sm font-bold">Služby</h2>
				<a class="text-xs font-semibold text-accent hover:underline" href="/app/sluzby">Všechny</a>
			</div>
			{#if data.services.length}
				<ul class="grid gap-3 lg:grid-cols-2">
					{#each data.services as s (s.id)}
						{@const tone = expiryTone(s.expiresAt)}
						<li class="min-w-0">
							<a href="/app/sluzby/{s.id}" class="block h-full rounded-[6px] border border-line bg-surface p-4 transition-colors hover:bg-surface-2">
								<div class="flex items-start justify-between gap-3">
									<div class="min-w-0">
										<div class="truncate font-bold">{s.label}</div>
										<div class="mt-0.5 truncate text-xs text-muted">
											<ServiceKind kind={s.kind} size={12} />{s.plan ? ` · ${s.plan}` : ''}{s.domain ? ' · ' : ''}<span class="mono">{s.domain}</span>
										</div>
									</div>
									<Pill tone={SERVICE_TONE[s.status]}>{SERVICE_STATUS_LABEL[s.status]}</Pill>
								</div>
								{#if s.status === 'pending'}
									<p class="mt-3 border-t border-line pt-3 text-xs text-muted">Pracujeme na tom. Stav monitoringu se ukáže po spuštění.</p>
								{:else}
									<div class="mt-3 border-t border-line pt-3">
										<Health health={data.health[s.id]} />
									</div>
								{/if}
								<div class="mt-3 flex items-center justify-between gap-2 text-xs">
									<span class="text-muted">Platí do</span>
									<span class="flex items-center gap-1.5">
										<span class="mono">{date(s.expiresAt)}</span>
										{#if s.expiresAt}<span class={TEXT_TONE[tone]}>{expiryHint(s.expiresAt)}</span>{/if}
									</span>
								</div>
							</a>
						</li>
					{/each}
				</ul>
			{:else}
				<div class="rounded-[6px] border border-line bg-surface">
					<Empty title="Zatím tu nemáte žádnou službu"><a class="underline" href="/app/objednat">Objednejte si první</a> přímo tady.</Empty>
				</div>
			{/if}
		</section>

		<Panel title="Otevřené požadavky" flush>
			{#snippet actions()}<a class="text-xs font-semibold text-accent hover:underline" href="/app/podpora">Všechny</a>{/snippet}
			{#if data.openTickets.length}
				<ul>
					{#each data.openTickets as t (t.id)}
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
				<Empty title="Nic otevřeného">Potřebujete něco? <a class="underline" href="/app/podpora/novy">Napište nám</a>.</Empty>
			{/if}
		</Panel>
	</div>

	<div class="flex min-w-0 flex-col gap-5">
		<Panel title="Domény, které brzy vyprší" flush>
			{#snippet actions()}<a class="text-xs font-semibold text-accent hover:underline" href="/app/domeny">Všechny</a>{/snippet}
			{#if data.expiringDomains.length}
				<ul class="text-sm">
					{#each data.expiringDomains as d (d.id)}
						{@const tone = expiryTone(d.expiresAt, 60)}
						<li class="flex items-center gap-3 border-b border-line px-4 py-2.5 last:border-b-0">
							<Led state={tone} />
							<span class="min-w-0 flex-1">
								<span class="mono block truncate font-medium">{d.name}</span>
								<span class="block text-xs text-muted">{d.managedByUs ? 'Prodloužíme za vás' : 'Prodlužujete u svého registrátora'}</span>
							</span>
							<span class="text-right text-xs">
								<span class="mono block">{date(d.expiresAt)}</span>
								<span class="block {TEXT_TONE[tone]}">{expiryHint(d.expiresAt)}</span>
							</span>
						</li>
					{/each}
				</ul>
			{:else}
				<Empty title="Do 60 dní nic nevyprší" />
			{/if}
		</Panel>

		<Contact />
	</div>
</div>
