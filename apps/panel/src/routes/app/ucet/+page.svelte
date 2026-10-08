<script lang="ts">
	import { enhance } from '$app/forms';
	import { ShieldCheck, ShieldOff } from '@lucide/svelte';
	import Button from '#lib/components/Button.svelte';
	import Field from '#lib/components/Field.svelte';
	import FormMessage from '#lib/components/FormMessage.svelte';
	import PageHeader from '#lib/components/PageHeader.svelte';
	import Panel from '#lib/components/Panel.svelte';
	import Pill from '#lib/components/Pill.svelte';
	import { ago, dateTime } from '#lib/format.ts';
	import { keepResult } from '#lib/forms.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const msg = (action: string) => (form?.action === action ? form : null);
</script>

<PageHeader title="Účet">
	{#snippet meta()}<span>Přihlášení a zabezpečení. Přihlašujete se jako <span class="font-medium break-all text-ink">{data.me.email}</span>.</span>{/snippet}
</PageHeader>

<div class="grid gap-5 xl:grid-cols-2">
	<div class="flex min-w-0 flex-col gap-5">
		<Panel title="Jméno">
			<FormMessage form={msg('name')} />
			<form method="POST" action="?/name" use:enhance={keepResult()} class="flex flex-col gap-3 sm:flex-row sm:items-end">
				<Field label="Jak vás oslovovat" id="name" class="flex-1">
					<input class="input" id="name" name="name" required maxlength={data.limits.name} value={data.me.name} autocomplete="name" />
				</Field>
				<Button type="submit">Uložit</Button>
			</form>
			<p class="mt-3 text-xs text-muted">E-mail pro přihlášení vám změníme na požádání přes podporu.</p>
		</Panel>

		<Panel title="Heslo">
			<FormMessage form={msg('password')} />
			<form method="POST" action="?/password" use:enhance={keepResult({ reset: true })} class="flex flex-col gap-3">
				<Field label="Současné heslo" id="current">
					<input class="input" id="current" name="current" type="password" required autocomplete="current-password" />
				</Field>
				<div class="grid gap-3 sm:grid-cols-2">
					<Field label="Nové heslo" id="next" hint="Alespoň 12 znaků.">
						<input class="input" id="next" name="next" type="password" required minlength="12" maxlength="200" autocomplete="new-password" />
					</Field>
					<Field label="Nové heslo znovu" id="confirm">
						<input class="input" id="confirm" name="confirm" type="password" required minlength="12" maxlength="200" autocomplete="new-password" />
					</Field>
				</div>
				<div class="flex flex-wrap items-center justify-between gap-2">
					<span class="text-xs text-muted">
						Po změně odhlásíme ostatní zařízení{data.sessions > 1 ? ` (teď přihlášeno: ${data.sessions})` : ''}.
					</span>
					<Button type="submit" variant="primary">Změnit heslo</Button>
				</div>
			</form>
		</Panel>
	</div>

	<div class="flex min-w-0 flex-col gap-5">
		<Panel title="Dvoufázové ověření">
			<FormMessage form={msg('2fa')} />
			{#if data.me.hasTotp}
				<div class="flex items-start gap-3">
					<ShieldCheck size={20} class="mt-0.5 shrink-0 text-ok" />
					<div class="min-w-0 text-sm">
						<div class="font-semibold">Zapnuté</div>
						<p class="text-muted">Při přihlášení chceme kromě hesla i kód z ověřovací aplikace.</p>
					</div>
				</div>
				<form method="POST" action="?/disable2fa" use:enhance={keepResult({ reset: true })} class="mt-4 flex flex-col gap-3 border-t border-line pt-4 sm:flex-row sm:items-end">
					<Field label="Kód z aplikace pro vypnutí" id="code" class="flex-1">
						<input class="input mono tracking-[0.3em]" id="code" name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="7" required />
					</Field>
					<Button type="submit" variant="danger">Vypnout</Button>
				</form>
			{:else}
				<div class="flex items-start gap-3">
					<ShieldOff size={20} class="mt-0.5 shrink-0 text-muted" />
					<div class="min-w-0 text-sm">
						<div class="font-semibold">Vypnuté</div>
						<p class="text-muted">
							Doporučujeme zapnout. I když někdo zjistí vaše heslo, bez telefonu se nepřihlásí. Stačí aplikace jako Google
							Authenticator, 1Password nebo Aegis.
						</p>
					</div>
				</div>
				<div class="mt-4 flex justify-end">
					<Button href="/nastaveni-2fa" variant="primary">Zapnout ověření</Button>
				</div>
			{/if}
		</Panel>

		<Panel title="Lidé s přístupem" flush>
			<ul>
				{#each data.colleagues as c (c.id)}
					<li class="flex items-center gap-3 border-b border-line px-4 py-2.5 last:border-b-0">
						<div class="grid size-8 shrink-0 place-items-center rounded-full bg-surface-2 text-[11px] font-bold text-muted" aria-hidden="true">
							{c.name.split(' ').map((p) => p[0]).slice(0, 2).join('')}
						</div>
						<div class="min-w-0 flex-1">
							<div class="truncate text-sm font-semibold">{c.name}{c.id === data.me.id ? ' (vy)' : ''}</div>
							<div class="truncate text-xs text-muted">{c.email}</div>
						</div>
						<div class="flex shrink-0 flex-col items-end gap-1 text-xs">
							{#if c.disabled}
								<Pill tone="off">zablokovaný</Pill>
							{:else if !c.activated}
								<Pill tone="warn">pozvánka čeká</Pill>
							{:else if c.hasTotp}
								<Pill tone="ok">2FA</Pill>
							{/if}
							{#if c.lastLoginAt}<span class="text-muted" title={dateTime(c.lastLoginAt)}>{ago(c.lastLoginAt)}</span>{/if}
						</div>
					</li>
				{/each}
			</ul>
			<p class="border-t border-line px-4 py-3 text-xs text-muted">
				Přidat kolegu nebo někomu přístup odebrat?
				<a class="font-semibold text-accent hover:underline" href="/app/podpora/novy?predmet={encodeURIComponent('Přístupy do klientské zóny')}">Napište nám</a>.
			</p>
		</Panel>
	</div>
</div>
