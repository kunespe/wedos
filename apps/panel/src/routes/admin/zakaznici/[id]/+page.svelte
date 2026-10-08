<script lang="ts">
	import { enhance } from '$app/forms';
	import { keepResult } from '#lib/forms.ts';
	import { Check, Copy } from '@lucide/svelte';
	import Button from '#lib/components/Button.svelte';
	import Empty from '#lib/components/Empty.svelte';
	import FormMessage from '#lib/components/FormMessage.svelte';
	import Led from '#lib/components/Led.svelte';
	import PageHeader from '#lib/components/PageHeader.svelte';
	import Panel from '#lib/components/Panel.svelte';
	import Pill from '#lib/components/Pill.svelte';
	import { ago, czk, date, daysUntil, KIND_LABEL, TICKET_STATUS_LABEL } from '#lib/format.ts';
	import CustomerFields from '../CustomerFields.svelte';
	import ServiceStatus from '../../sluzby/ServiceStatus.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const c = $derived(data.customer);
	let copied = $state(false);
	let edit = $state(false);
	const mrr = $derived(data.services.filter((s) => s.status === 'active').reduce((sum, s) => sum + (s.priceMonthly ?? 0), 0));

	async function copy(text: string) {
		await navigator.clipboard.writeText(text);
		copied = true;
		setTimeout(() => (copied = false), 1500);
	}
</script>

<PageHeader title={c.company || c.name} crumbs={[{ href: '/admin/zakaznici', label: 'Zákazníci' }]}>
	{#snippet meta()}
		{#if c.ico}<span class="mono text-xs">IČO {c.ico}</span>{/if}
		<span>zákazníkem od {date(c.createdAt)}</span>
		<span class="mono text-xs">MRR {czk(mrr)}</span>
	{/snippet}
	{#snippet actions()}
		<Button href="mailto:{c.email}">Napsat</Button>
		{#if c.phone}<Button href="tel:{c.phone}">Zavolat</Button>{/if}
	{/snippet}
</PageHeader>

<FormMessage {form} />
{#if form && 'invite' in form && form.invite}
	<div class="mb-5 rounded-[6px] border border-accent/30 bg-info-bg p-4">
		<div class="text-sm font-bold">Odkaz pro {form.inviteFor}</div>
		<div class="mt-2 flex items-center gap-2">
			<code class="mono min-w-0 flex-1 truncate rounded-[6px] border border-line bg-surface px-2.5 py-1.5 text-xs">{form.invite}</code>
			<Button size="sm" onclick={() => copy(String(form.invite))}>
				{#if copied}<Check size={14} /> Zkopírováno{:else}<Copy size={14} /> Kopírovat{/if}
			</Button>
		</div>
	</div>
{/if}

<div class="grid gap-5 xl:grid-cols-[1.5fr_1fr]">
	<div class="flex flex-col gap-5">
		<Panel title="Služby" flush>
			{#if data.services.length}
				<ul>
					{#each data.services as s (s.id)}
						{@const d = daysUntil(s.expiresAt)}
						<li class="border-b border-line last:border-b-0">
							<a href="/admin/sluzby/{s.id}" class="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-2">
								<span class="min-w-0 flex-1">
									<span class="block truncate font-semibold">{s.label}</span>
									<span class="block text-xs text-muted">{KIND_LABEL[s.kind]} · {czk(s.priceMonthly)} / měs. · {s.period === 'year' ? 'ročně' : 'měsíčně'}</span>
								</span>
								<span class="mono hidden text-xs sm:block {d != null && d <= 14 ? 'text-warn' : 'text-muted'}">{s.expiresAt ? date(s.expiresAt) : ''}</span>
								<ServiceStatus status={s.status} />
							</a>
						</li>
					{/each}
				</ul>
			{:else}
				<Empty title="Žádné služby" />
			{/if}
			<details class="border-t border-line">
				<summary class="cursor-pointer px-4 py-2.5 text-sm font-semibold text-accent">Přidat službu ručně</summary>
				<form method="POST" action="?/addService" class="grid gap-3 p-4 pt-1 sm:grid-cols-2">
					<div>
						<label class="label" for="s-plan">Tarif</label>
						<select class="input" id="s-plan" name="plan" required>
							{#each data.plans as p (p.code)}<option value={p.code}>{p.name} ({p.monthly == null ? 'individuálně' : czk(p.monthly)})</option>{/each}
						</select>
					</div>
					<div>
						<label class="label" for="s-domain">Doména</label>
						<input class="input" id="s-domain" name="domain" placeholder="firma.cz" />
					</div>
					<div>
						<label class="label" for="s-period">Fakturace</label>
						<select class="input" id="s-period" name="period"><option value="year">Ročně</option><option value="month">Měsíčně</option></select>
					</div>
					<div>
						<label class="label" for="s-node">Uzel</label>
						<select class="input" id="s-node" name="node"><option value="">Žádný (VPS, správa)</option>{#each data.nodes as n (n.id)}<option value={n.id}>{n.name}</option>{/each}</select>
					</div>
					<div class="sm:col-span-2 flex justify-end"><Button type="submit" variant="primary">Založit službu</Button></div>
				</form>
			</details>
		</Panel>

		<Panel title="Domény" flush>
			{#if data.domains.length}
				<ul class="text-sm">
					{#each data.domains as dm (dm.id)}
						{@const d = daysUntil(dm.expiresAt)}
						<li class="flex items-center gap-3 border-b border-line px-4 py-2 last:border-b-0">
							<Led state={d == null ? 'off' : d < 0 ? 'bad' : d <= 30 ? 'warn' : 'ok'} />
							<a class="mono flex-1 truncate hover:underline" href="/admin/domeny/{dm.id}">{dm.name}</a>
							<span class="text-xs text-muted">{dm.managedByUs ? dm.registrar : 'u zákazníka'}</span>
							<span class="mono text-xs text-muted">{date(dm.expiresAt)}</span>
						</li>
					{/each}
				</ul>
			{:else}
				<Empty title="Žádné domény" />
			{/if}
			<details class="border-t border-line">
				<summary class="cursor-pointer px-4 py-2.5 text-sm font-semibold text-accent">Přidat doménu</summary>
				<form method="POST" action="?/addDomain" use:enhance={keepResult({ reset: true })} class="grid gap-3 p-4 pt-1 sm:grid-cols-3">
					<div><label class="label" for="d-name">Doména</label><input class="input mono" id="d-name" name="name" required placeholder="firma.cz" /></div>
					<div><label class="label" for="d-exp">Expirace</label><input class="input" id="d-exp" name="expiresAt" type="date" /></div>
					<div><label class="label" for="d-reg">Registrátor</label><input class="input" id="d-reg" name="registrar" value="Subreg" /></div>
					<label class="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" name="managedByUs" checked class="size-4" /> Prodlužujeme my</label>
					<div class="flex justify-end"><Button type="submit">Přidat</Button></div>
				</form>
			</details>
		</Panel>

		<Panel title="Tikety" flush>
			{#if data.tickets.length}
				<ul class="text-sm">
					{#each data.tickets as t (t.id)}
						<li class="border-b border-line last:border-b-0">
							<a class="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-2" href="/admin/tikety/{t.id}">
								<span class="mono w-10 text-xs text-muted">#{t.id}</span>
								<span class="flex-1 truncate">{t.subject}</span>
								<span class="text-xs text-muted">{ago(t.updatedAt)}</span>
								<Pill tone={t.status === 'open' ? 'warn' : t.status === 'waiting' ? 'act' : 'off'}>{TICKET_STATUS_LABEL[t.status]}</Pill>
							</a>
						</li>
					{/each}
				</ul>
			{:else}
				<Empty title="Bez tiketů" />
			{/if}
		</Panel>
	</div>

	<div class="flex flex-col gap-5">
		<Panel title="Údaje">
			{#snippet actions()}<Button size="sm" variant="ghost" onclick={() => (edit = !edit)}>{edit ? 'Zavřít' : 'Upravit'}</Button>{/snippet}
			{#if edit}
				<form method="POST" action="?/update" use:enhance={keepResult({ onDone: () => (edit = form?.message ? false : edit) })}>
					<CustomerFields values={c} errors={form && 'errors' in form ? (form.errors ?? {}) : {}} />
					<div class="mt-4 flex justify-end"><Button type="submit" variant="primary">Uložit</Button></div>
				</form>
			{:else}
				<dl class="grid grid-cols-[80px_1fr] gap-x-3 gap-y-1.5 text-sm">
					<dt class="text-muted">Kontakt</dt><dd>{c.name}</dd>
					<dt class="text-muted">E-mail</dt><dd class="break-all">{c.email}</dd>
					{#if c.phone}<dt class="text-muted">Telefon</dt><dd>{c.phone}</dd>{/if}
					{#if c.dic}<dt class="text-muted">DIČ</dt><dd class="mono">{c.dic}</dd>{/if}
					{#if c.address}<dt class="text-muted">Adresa</dt><dd>{c.address}</dd>{/if}
				</dl>
				{#if c.note}<p class="mt-3 rounded-[6px] bg-surface-2 p-3 text-sm whitespace-pre-wrap">{c.note}</p>{/if}
			{/if}
		</Panel>

		<Panel title="Přístupy do klientské zóny" flush>
			<ul class="text-sm">
				{#each data.users as u (u.id)}
					<li class="flex flex-wrap items-center gap-2 border-b border-line px-4 py-2.5 last:border-b-0">
						<div class="min-w-0 flex-1">
							<div class="truncate font-semibold">{u.name}</div>
							<div class="truncate text-xs text-muted">{u.email}{u.lastLoginAt ? ` · naposledy ${ago(u.lastLoginAt)}` : ''}</div>
						</div>
						{#if u.disabled}<Pill tone="bad">Zablokován</Pill>{:else if !u.activated}<Pill tone="warn">Čeká na pozvánku</Pill>{:else}<Pill tone="ok">Aktivní{u.hasTotp ? ' · 2FA' : ''}</Pill>{/if}
						<div class="flex w-full gap-1.5">
							<form method="POST" action="?/invite" use:enhance={keepResult()}>
								<input type="hidden" name="user" value={u.id} />
								<Button size="sm" type="submit">{u.activated ? 'Odkaz na nové heslo' : 'Nový odkaz'}</Button>
							</form>
							<form method="POST" action="?/invite" use:enhance={keepResult()}>
								<input type="hidden" name="user" value={u.id} /><input type="hidden" name="send" value="1" />
								<Button size="sm" type="submit" variant="ghost">Poslat e-mailem</Button>
							</form>
							<form method="POST" action="?/toggleUser" use:enhance={keepResult()} class="ml-auto">
								<input type="hidden" name="user" value={u.id} />
								<Button size="sm" type="submit" variant={u.disabled ? 'secondary' : 'danger'}>{u.disabled ? 'Povolit' : 'Zablokovat'}</Button>
							</form>
						</div>
					</li>
				{:else}
					<li class="px-4 py-3 text-sm text-muted">Zákazník zatím nemá přístup.</li>
				{/each}
			</ul>
			<form method="POST" action="?/addUser" use:enhance={keepResult({ reset: true })} class="grid gap-2 border-t border-line p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
				<div><label class="label" for="u-name">Jméno</label><input class="input" id="u-name" name="name" required /></div>
				<div><label class="label" for="u-email">E-mail</label><input class="input" id="u-email" name="email" type="email" required /></div>
				<Button type="submit">Přidat</Button>
			</form>
		</Panel>
	</div>
</div>
