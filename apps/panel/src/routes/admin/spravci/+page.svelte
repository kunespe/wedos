<script lang="ts">
	import { enhance } from '$app/forms';
	import { keepResult } from '#lib/forms.ts';
	import Button from '#lib/components/Button.svelte';
	import Field from '#lib/components/Field.svelte';
	import FormMessage from '#lib/components/FormMessage.svelte';
	import PageHeader from '#lib/components/PageHeader.svelte';
	import Panel from '#lib/components/Panel.svelte';
	import Pill from '#lib/components/Pill.svelte';
	import SecretValue from '#lib/components/SecretValue.svelte';
	import { ago, dateTime } from '#lib/format.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	let confirming = $state<string | null>(null);
	const link = $derived(form && 'link' in form ? form.link : null);
	const values = $derived(form && 'values' in form ? form.values : null);

	const done = keepResult({ onDone: () => (confirming = null) });
</script>

<PageHeader title="Správci">
	{#snippet meta()}Lidé s přístupem do administrace. Každý správce musí mít zapnuté dvoufázové ověření.{/snippet}
</PageHeader>

<FormMessage {form} />

{#if link}
	<section class="mb-5 rounded-[6px] border border-accent/30 bg-info-bg p-4" aria-labelledby="link-title">
		<h2 id="link-title" class="text-sm font-bold">{link.purpose === 'invite' ? 'Pozvánka' : 'Odkaz na nové heslo'} pro {link.email}</h2>
		<p class="mt-1 mb-3 text-sm text-muted">
			{link.mailed ? 'Odeslali jsme ho e-mailem. Pro jistotu je i tady, zobrazí se jen teď.' : 'Předejte ho bezpečnou cestou, zobrazí se jen teď.'}
			Platí {link.purpose === 'invite' ? '7 dní' : '24 hodin'} a jen jednou; starší odkazy tohoto účtu přestaly platit.
		</p>
		<SecretValue label="Odkaz" value={link.url} />
	</section>
{/if}

<div class="grid gap-5 [&>*]:min-w-0 xl:grid-cols-[1fr_340px]">
	<Panel title="Správci" flush>
		<div class="overflow-x-auto">
			<table class="w-full text-sm">
				<thead>
					<tr class="bg-surface-2 text-left text-xs text-muted">
						<th class="h-9 px-4 font-semibold">Jméno</th>
						<th class="h-9 px-4 font-semibold">2FA</th>
						<th class="h-9 px-4 font-semibold">Heslo</th>
						<th class="h-9 px-4 font-semibold">Poslední přihlášení</th>
						<th class="h-9 px-4 font-semibold">Stav</th>
						<th class="relative h-9 px-4 font-semibold"><span class="sr-only">Akce</span></th>
					</tr>
				</thead>
				<tbody>
					{#each data.admins as a (a.id)}
						{@const me = a.id === data.meId}
						<tr class="border-t border-line align-top {a.disabled ? 'text-muted' : ''}">
							<td class="px-4 py-2.5">
								<div class="font-semibold whitespace-nowrap">{a.name}{#if me}<span class="ml-1.5 text-xs font-normal text-muted">(vy)</span>{/if}</div>
								<div class="text-xs text-muted">{a.email}</div>
							</td>
							<td class="px-4 py-2.5 whitespace-nowrap">
								{#if a.hasTotp}<Pill tone="ok">Zapnuté</Pill>{:else}<Pill tone="warn">Nenastavené</Pill>{/if}
							</td>
							<td class="px-4 py-2.5 text-xs whitespace-nowrap">
								{#if a.hasPassword}Nastavené{:else}<span class="text-warn">Čeká na pozvánku</span>{/if}
								{#if a.invite}<div class="text-[11px] text-muted">odkaz platí do {dateTime(a.invite.expiresAt)}</div>{/if}
							</td>
							<td class="px-4 py-2.5 text-xs whitespace-nowrap" title={a.lastLoginAt ? dateTime(a.lastLoginAt) : undefined}>
								{a.lastLoginAt ? ago(a.lastLoginAt) : 'Nikdy'}
							</td>
							<td class="px-4 py-2.5 whitespace-nowrap">
								{#if a.disabled}<Pill tone="bad">Zablokovaný</Pill>{:else}<Pill tone="ok">Aktivní</Pill>{/if}
							</td>
							<td class="px-4 py-2 text-right">
								{#if confirming === `${a.id}:toggle`}
									<form method="POST" action="?/toggle" use:enhance={done} class="flex items-center justify-end gap-1.5 whitespace-nowrap">
										<input type="hidden" name="id" value={a.id} />
										<span class="text-xs font-semibold text-bad">Odhlásí ho všude.</span>
										<Button type="submit" size="sm" variant="danger">Zablokovat</Button>
										<Button size="sm" variant="ghost" onclick={() => (confirming = null)}>Zrušit</Button>
									</form>
								{:else if confirming === `${a.id}:2fa`}
									<form method="POST" action="?/reset2fa" use:enhance={done} class="flex items-center justify-end gap-1.5 whitespace-nowrap">
										<input type="hidden" name="id" value={a.id} />
										<span class="text-xs font-semibold text-bad">Musí si 2FA nastavit znovu.</span>
										<Button type="submit" size="sm" variant="danger">Resetovat 2FA</Button>
										<Button size="sm" variant="ghost" onclick={() => (confirming = null)}>Zrušit</Button>
									</form>
								{:else if confirming === `${a.id}:link`}
									<form method="POST" action="?/resetPassword" use:enhance={done} class="flex flex-wrap items-center justify-end gap-1.5 whitespace-nowrap">
										<input type="hidden" name="id" value={a.id} />
										<label class="flex items-center gap-1.5 text-xs">
											<input type="checkbox" name="send" checked class="size-3.5 accent-[var(--accent)]" /> poslat e-mailem
										</label>
										<Button type="submit" size="sm" variant="primary">Vytvořit odkaz</Button>
										<Button size="sm" variant="ghost" onclick={() => (confirming = null)}>Zrušit</Button>
									</form>
								{:else}
									<div class="flex flex-wrap justify-end gap-1">
										{#if !a.disabled}
											<Button size="sm" variant="ghost" onclick={() => (confirming = `${a.id}:link`)}>Poslat nový odkaz na heslo</Button>
										{/if}
										{#if !me}
											{#if a.hasTotp}
												<Button size="sm" variant="ghost" onclick={() => (confirming = `${a.id}:2fa`)}>Resetovat 2FA</Button>
											{/if}
											{#if a.disabled}
												<form method="POST" action="?/toggle" use:enhance={keepResult()}>
													<input type="hidden" name="id" value={a.id} />
													<Button type="submit" size="sm">Odblokovat</Button>
												</form>
											{:else}
												<Button size="sm" variant="danger" onclick={() => (confirming = `${a.id}:toggle`)}>Zablokovat</Button>
											{/if}
										{/if}
									</div>
								{/if}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</Panel>

	<Panel title="Pozvat správce">
		<form method="POST" action="?/invite" use:enhance={keepResult({ reset: true })} class="flex flex-col gap-3">
			<Field label="Jméno a příjmení" id="inv-name">
				<input id="inv-name" name="name" class="input" required minlength="2" maxlength="160" autocomplete="off" value={values?.name ?? ''} />
			</Field>
			<Field label="E-mail" id="inv-email">
				<input id="inv-email" name="email" type="email" class="input" required maxlength="254" autocomplete="off" value={values?.email ?? ''} />
			</Field>
			<label class="flex items-center gap-2 text-sm">
				<input type="checkbox" name="send" checked class="size-4 accent-[var(--accent)]" />
				Poslat pozvánku e-mailem
			</label>
			<Button type="submit" variant="primary">Pozvat</Button>
			<p class="text-xs text-muted">
				Vznikne účet správce bez hesla a jednorázový odkaz na 7 dní. Po nastavení hesla si nový správce povinně zapne dvoufázové ověření.
			</p>
		</form>
	</Panel>
</div>
