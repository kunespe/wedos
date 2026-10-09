<script lang="ts">
	import { enhance } from '$app/forms';
	import { keepResult } from '#lib/forms.ts';
	import Button from '#lib/components/Button.svelte';
	import ConfirmAction from '#lib/components/ConfirmAction.svelte';
	import Field from '#lib/components/Field.svelte';
	import FormMessage from '#lib/components/FormMessage.svelte';
	import PageHeader from '#lib/components/PageHeader.svelte';
	import Panel from '#lib/components/Panel.svelte';
	import Pill from '#lib/components/Pill.svelte';
	import { date, daysUntil } from '#lib/format.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const d = $derived(data.domain);
	const w = $derived(data.wedos);
	const days = $derived(daysUntil(d.expiresAt));
	const errors = $derived<Record<string, string>>(form && 'errors' in form ? (form.errors ?? {}) : {});
	const result = $derived(form && 'wedos' in form ? form.wedos : null);
	let confirmDelete = $state(false);

	const contactFields = [
		{ name: 'fname', label: 'Jméno' },
		{ name: 'lname', label: 'Příjmení' },
		{ name: 'company', label: 'Firma' },
		{ name: 'addr_street', label: 'Ulice a číslo' },
		{ name: 'addr_city', label: 'Město' },
		{ name: 'addr_zip', label: 'PSČ' },
		{ name: 'addr_country', label: 'Země (kód)' },
		{ name: 'phone', label: 'Telefon' },
		{ name: 'email', label: 'E-mail' },
		{ name: 'notify_email', label: 'E-mail pro oznámení' },
		{ name: 'ident', label: 'Identifikátor (IČO)' },
		{ name: 'dic', label: 'DIČ' }
	] as const;
	const identTypes = [
		{ value: '', label: 'žádný' },
		{ value: 'ico', label: 'IČO' },
		{ value: 'op', label: 'občanský průkaz' },
		{ value: 'passport', label: 'pas' },
		{ value: 'birthday', label: 'datum narození' },
		{ value: 'mpsv', label: 'MPSV' }
	];
	const STATUS_LABEL: Record<string, string> = { active: 'aktivní', expired: 'propadlá', deleted: 'smazaná', pending: 'čeká', transfer: 'převádí se' };
</script>

<PageHeader title={d.name} crumbs={[{ href: '/admin/domeny', label: 'Domény' }, { href: `/admin/zakaznici/${data.customer.id}`, label: data.customer.company || data.customer.name }]}>
	{#snippet meta()}
		{#if days == null}<Pill>Bez data expirace</Pill>{:else if days < 0}<Pill tone="bad">Propadlá {-days} dní</Pill>{:else if days <= 30}<Pill tone="warn">Vyprší za {days} dní</Pill>{:else}<Pill tone="ok">Platí do {date(d.expiresAt)}</Pill>{/if}
	{/snippet}
	{#snippet actions()}
		<Button href="https://www.nic.cz/whois/domain/{d.name}/" target="_blank" rel="noreferrer">WHOIS</Button>
	{/snippet}
</PageHeader>

<FormMessage {form} />

<div class="grid max-w-5xl gap-5 lg:grid-cols-[1.4fr_1fr]">
	<div class="flex min-w-0 flex-col gap-5">
		<form method="POST" action="?/update" use:enhance={keepResult()}>
			<Panel title="Evidence">
				<div class="grid gap-4 sm:grid-cols-2">
					<Field label="Registrátor" id="d-reg"><input class="input" id="d-reg" name="registrar" value={d.registrar} /></Field>
					<Field label="Expirace" id="d-exp" error={errors.expiresAt}><input class="input" id="d-exp" name="expiresAt" type="date" value={d.expiresAt ?? ''} /></Field>
					<label class="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" name="managedByUs" checked={d.managedByUs} class="size-4" /> Prodlužujeme my (fakturujeme 249 Kč/rok)</label>
					<Field label="Poznámka" id="d-note" class="sm:col-span-2"><textarea class="input" id="d-note" name="note">{d.note ?? ''}</textarea></Field>
				</div>
				<div class="mt-5 flex justify-end"><Button type="submit" variant="primary">Uložit</Button></div>
			</Panel>
		</form>

		<Panel title="WEDOS" flush>
			{#snippet actions()}
				{#if !w.configured}<Pill>Nenastaveno</Pill>{:else if w.live}<Pill tone="bad">Ostrý režim</Pill>{:else}<Pill tone="warn">Testovací režim</Pill>{/if}
			{/snippet}
			{#if !w.configured}
				<div class="p-4 text-sm">
					<p>Propojení s WEDOS WAPI není v tomto prostředí nastavené (chybí <span class="mono">{w.missing.join(', ')}</span>), proto tu nejsou tlačítka pro registraci a prodloužení.</p>
					<p class="mt-2 text-muted">Doménu zatím vyřiďte ručně v administraci WEDOS a sem zapište registrátora a expiraci. Nastavení popisuje README panelu (oddíl WEDOS).</p>
				</div>
			{:else}
				<div class="border-b border-line px-4 py-3 text-sm">
					<p>
						Účet <span class="mono">{w.user}</span>.
						{#if w.live}
							<strong class="text-bad">Ostrý režim:</strong> potvrzené změny se u WEDOS provedou a strhnou kredit.
						{:else}
							<strong class="text-warn">Testovací režim:</strong> WEDOS změny jen ověří, nic se neregistruje ani neplatí. Ostrý režim zapne <span class="mono">WEDOS_WAPI_LIVE=1</span>.
						{/if}
					</p>
					<div class="mt-3 flex flex-wrap gap-2">
						<form method="POST" action="?/wedosInfo" use:enhance={keepResult()}><Button type="submit">Načíst stav z WEDOS</Button></form>
						<form method="POST" action="?/wedosCheck" use:enhance={keepResult()}><Button type="submit">Zkontrolovat dostupnost</Button></form>
					</div>
					{#if result?.kind === 'info'}
						{@const info = result.info}
						<dl class="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 rounded-[6px] border border-line bg-surface-2 px-3 py-2.5 text-sm">
							<dt class="text-muted">Stav</dt><dd>{STATUS_LABEL[info.status] ?? info.status}</dd>
							<dt class="text-muted">Expirace</dt><dd class="mono">{info.expiration ? date(info.expiration) : 'neuvedena'}</dd>
							<dt class="text-muted">Majitel</dt><dd class="mono break-all">{info.owner_c ?? '-'}</dd>
							<dt class="text-muted">NSSET</dt><dd class="mono break-all">{info.nsset || '-'}</dd>
							{#if info.setup_date}<dt class="text-muted">Založena</dt><dd class="mono">{info.setup_date}</dd>{/if}
						</dl>
						{#if info.expiration && info.expiration !== d.expiresAt}
							<form method="POST" action="?/wedosSetExpiry" use:enhance={keepResult()} class="mt-2">
								<input type="hidden" name="expiresAt" value={info.expiration} />
								<Button type="submit" size="sm" variant="primary">Zapsat expiraci {date(info.expiration)}</Button>
							</form>
						{:else if info.expiration}
							<p class="mt-2 text-xs text-muted">Expirace v panelu odpovídá WEDOS.</p>
						{/if}
					{:else if result?.kind === 'check'}
						<p class="mt-3 flex flex-wrap items-center gap-2 text-sm">
							<Pill tone={result.available ? 'ok' : 'off'}>{result.available ? 'Volná' : 'Nelze registrovat'}</Pill>{result.text}
						</p>
					{/if}
				</div>

				<div class="border-b border-line px-4 py-3">
					<h3 class="text-sm font-bold">Kontakt majitele pro .{w.tld}</h3>
					{#if w.contactHandle}
						<p class="mt-1 text-sm">Zákazník má kontakt <span class="mono font-semibold">{w.contactHandle}</span>, použije se při registraci i převodu.</p>
					{:else if w.contactPreview}
						{@const c = w.contactPreview}
						<p class="mt-1 text-sm text-muted">Zákazník zatím nemá kontakt u WEDOS. Údaje jsou předvyplněné ze zákazníka, zkontrolujte je (hlavně rozdělení adresy).</p>
						<details class="mt-2">
							<summary class="cursor-pointer text-sm font-semibold text-accent">Založit kontakt</summary>
							<div class="mt-3">
								<ConfirmAction action="?/wedosContact" label="Založit kontakt" live={w.live} note="Založení kontaktu je zdarma. Údaje se zapíší do registru jako majitel domény.">
									{#snippet fields()}
										<div class="grid gap-3 sm:grid-cols-2">
											{#each contactFields as f (f.name)}
												<Field label={f.label} id="c-{f.name}" error={errors[f.name]}>
													<input class="input" id="c-{f.name}" name={f.name} value={c[f.name]} />
												</Field>
											{/each}
											<Field label="Typ identifikátoru" id="c-ident_type" error={errors.ident_type}>
												<select class="input" id="c-ident_type" name="ident_type" value={c.ident_type}>
													{#each identTypes as t (t.value)}<option value={t.value}>{t.label}</option>{/each}
												</select>
											</Field>
										</div>
									{/snippet}
								</ConfirmAction>
							</div>
						</details>
						<details class="mt-2">
							<summary class="cursor-pointer text-sm font-semibold text-accent">Kontakt už u WEDOS existuje</summary>
							<form method="POST" action="?/wedosContactHandle" use:enhance={keepResult()} class="mt-2 flex flex-wrap items-end gap-2">
								<Field label="Handle kontaktu" id="c-handle"><input class="input mono" id="c-handle" name="handle" required placeholder="např. WEDOS-ABC123" /></Field>
								<Button type="submit">Uložit handle</Button>
							</form>
						</details>
					{/if}
				</div>

				{#if !d.expiresAt}
					<div class="border-b border-line px-4 py-3">
						<h3 class="text-sm font-bold">Registrace</h3>
						<p class="mt-1 mb-3 text-sm text-muted">
							Na 1 rok, majitel {w.contactHandle ?? '(chybí kontakt)'}, souhlas s pravidly registru za správce {w.rules.fname} {w.rules.lname}. Panel nejdřív ověří, že je doména volná.
						</p>
						<ConfirmAction action="?/wedosRegister" label="Registrovat" variant="primary" disabled={!w.contactHandle} live={w.live} note="Cena: roční registrace podle ceníku WEDOS, strhne se z kreditu účtu WEDOS." />
					</div>
				{/if}

				<div class="border-b border-line px-4 py-3">
					<h3 class="text-sm font-bold">Prodloužení</h3>
					<p class="mt-1 mb-3 text-sm text-muted">Prodlouží doménu u WEDOS o 1 rok a zapíše novou expiraci.</p>
					<ConfirmAction action="?/wedosRenew" label="Prodloužit o 1 rok" live={w.live} note="Cena: roční prodloužení podle ceníku WEDOS, strhne se z kreditu účtu WEDOS." />
				</div>

				<div class="border-b border-line px-4 py-3">
					<h3 class="text-sm font-bold">Převod k WEDOS</h3>
					<p class="mt-1 mb-3 text-sm text-muted">Panel nejdřív ověří, že převod je možný, a pak ho zahájí s AUTH-ID od současného registrátora.</p>
					<ConfirmAction action="?/wedosTransfer" label="Převést" live={w.live} note="Cena: převod podle ceníku WEDOS, strhne se z kreditu účtu WEDOS. AUTH-ID se nikam neukládá.">
						{#snippet fields()}
							<Field label="AUTH-ID" id="t-auth"><input class="input mono" id="t-auth" name="authInfo" autocomplete="off" maxlength="100" /></Field>
						{/snippet}
					</ConfirmAction>
				</div>

				<div class="px-4 py-3">
					<h3 class="text-sm font-bold">AUTH-ID pro odchod domény</h3>
					<p class="mt-1 mb-3 text-sm text-muted">WEDOS pošle autorizační kód na e-mail majitele uvedený v registru.</p>
					<ConfirmAction action="?/wedosSendAuth" label="Poslat AUTH-ID majiteli" live={w.live} note="Zdarma. Kód dostane majitel domény e-mailem, panel ho nevidí." />
				</div>
			{/if}
		</Panel>
	</div>
	<div class="flex flex-col gap-5">
		<Panel title="Ruční zápis prodloužení">
			<p class="mb-3 text-sm text-muted">Když doménu prodloužíte mimo panel (např. přímo v administraci registrátora), zapište tady posun expirace o rok.</p>
			<form method="POST" action="?/renew" use:enhance={keepResult()}><Button type="submit">Zapsat prodloužení o rok</Button></form>
		</Panel>
		<Panel title="Odebrat z evidence">
			{#if confirmDelete}
				<form method="POST" action="?/remove" class="flex flex-col gap-3">
					<p class="text-sm">Doména zmizí z panelu. U registrátora se nic nezmění.</p>
					<div class="flex gap-2"><Button type="submit" variant="danger">Odebrat</Button><Button variant="ghost" onclick={() => (confirmDelete = false)}>Zpět</Button></div>
				</form>
			{:else}
				<Button variant="danger" onclick={() => (confirmDelete = true)}>Odebrat doménu</Button>
			{/if}
		</Panel>
	</div>
</div>
