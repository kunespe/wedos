<script lang="ts">
	import { enhance } from '$app/forms';
	import { keepResult } from '#lib/forms.ts';
	import Button from '#lib/components/Button.svelte';
	import Empty from '#lib/components/Empty.svelte';
	import Field from '#lib/components/Field.svelte';
	import FormMessage from '#lib/components/FormMessage.svelte';
	import PageHeader from '#lib/components/PageHeader.svelte';
	import Panel from '#lib/components/Panel.svelte';
	import Pill from '#lib/components/Pill.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const mail = $derived(data.mail);
	const dns = $derived(form?.dns);
	const mib = (bytes: number) => Math.round(bytes / 1048576);
</script>

<PageHeader title="Pošta">
	{#snippet meta()}Mailcow na samostatném uzlu. Domény, schránky a přesměrování spravujete tady.{/snippet}
</PageHeader>
<FormMessage {form} />

{#if !data.status.configured}
	<Empty title="Mailserver není připojený">Správce musí připojit Mailcow API k tomuto panelu.</Empty>
{:else if data.error}
	<div role="alert" class="border border-bad/30 bg-bad-bg p-4 text-sm">{data.error} Obnovte stránku po kontrole spojení.</div>
{:else if mail}
	{#if !data.status.outboundReady}
		<p role="status" class="mb-5 border-l-2 border-warn bg-warn-bg px-4 py-3 text-sm">
			<strong>Příprava provozu.</strong> Schránky lze zakládat. Před přepnutím klientské pošty musí správce ověřit DNS, veřejný certifikát a odesílání.
		</p>
	{/if}
	<p class="mb-3 text-sm text-muted">Dočasně bez antiviru a fulltextového indexování, antispam je zapnutý. Disk má 40 GB; velikosti schránek přidělujte podle volného místa. Záloha do S3 zatím není připojená.</p>
	<p class="mb-5 text-sm">Po ověření provozu: server <strong>mail.serveros.cz</strong>, IMAP <strong>993 / SSL</strong>, SMTP <strong>587 / STARTTLS</strong> nebo <strong>465 / SSL</strong>. Přihlášení celou e-mailovou adresou.</p>

	<Panel title="Poštovní domény" flush>
		{#if mail.domains.length}
			<div class="overflow-x-auto"><table class="w-full text-left text-sm">
				<thead><tr class="bg-surface-2 text-xs text-muted"><th class="px-4 py-2">Doména</th><th class="px-4 py-2">Schránky</th><th class="px-4 py-2">Kvóta domény</th><th class="px-4 py-2">Stav</th></tr></thead>
				<tbody>{#each mail.domains as d (d.domain)}
					<tr class="border-t border-line"><td class="px-4 py-3"><strong>{d.domain}</strong><div class="text-xs text-muted">{d.description}</div><form method="POST" action="?/dns" use:enhance={keepResult()} class="mt-2"><input type="hidden" name="domain" value={d.domain} /><Button size="sm" variant="secondary" type="submit">Zobrazit DNS a DKIM</Button></form></td><td class="px-4 py-3">{d.mailboxes} / {d.mailboxLimit}</td><td class="px-4 py-3">{d.quotaMiB} MiB</td><td class="px-4 py-3"><Pill tone={d.active ? 'ok' : 'off'}>{d.active ? 'Zapnutá' : 'Pozastavená'}</Pill></td></tr>
				{/each}</tbody>
			</table></div>
		{:else}<Empty title="Zatím žádná poštovní doména">Založení domény nepřepíná její DNS ani nepřenáší staré zprávy.</Empty>{/if}
		<details class="border-t border-line p-4">
			<summary class="cursor-pointer text-sm font-semibold">Přidat doménu</summary>
			<form method="POST" action="?/domain" use:enhance={keepResult({ reset: true })} class="mt-4 grid max-w-3xl gap-3 sm:grid-cols-3">
				<Field label="Doména" id="domain"><input class="input" id="domain" name="domain" required placeholder="klient.cz" /></Field>
				<Field label="Zákazník / popis" id="description"><input class="input" id="description" name="description" maxlength="100" /></Field>
				<Field label="Kvóta domény (MiB)" id="domain-quota"><input class="input" id="domain-quota" name="quota" type="number" min="512" max="8192" value="2048" required /></Field>
				<div class="sm:col-span-3"><Button type="submit">Založit poštovní doménu</Button><p class="mt-2 text-xs text-muted">Nejvýše 10 schránek a 50 přesměrování na doménu. DNS měníte samostatně.</p></div>
			</form>
		</details>
	</Panel>
	{#if dns}
		<Panel title="DNS pro {dns.domain}" class="mt-5">
			<dl class="grid gap-x-4 gap-y-2 text-sm sm:grid-cols-[8rem_1fr]">
				<dt class="font-semibold">MX pro @</dt><dd class="mono break-all">10 mail.serveros.cz.</dd>
				<dt class="font-semibold">TXT DKIM</dt><dd><div class="mono mb-1">{dns.selector}._domainkey</div><code class="block break-all select-all">{dns.dkim || 'DKIM klíč není dostupný. Zkontrolujte poštovní doménu.'}</code></dd>
				<dt class="font-semibold">SPF</dt><dd>Do stávajícího jediného SPF záznamu přidejte <code class="select-all">ip4:37.235.108.134</code> pro současnou odchozí bránu. Zachovejte ostatní povolené odesílatele.</dd>
				<dt class="font-semibold">DMARC</dt><dd>Pokud zatím chybí: TXT <code>_dmarc</code> s hodnotou <code class="select-all">v=DMARC1; p=none</code>. Existující politiku zachovejte.</dd>
			</dl>
			<p class="mt-4 text-xs text-muted">MX přepněte až po migraci starých zpráv a závěrečném ověření. Ve starém VPS musí být po migraci také směrování této domény na nový server, aby odchozí brána nedoručovala do původních schránek.</p>
		</Panel>
	{/if}

	<Panel title="Schránky" class="mt-5" flush>
		{#if mail.mailboxes.length}
			<div class="overflow-x-auto"><table class="w-full text-left text-sm">
				<thead><tr class="bg-surface-2 text-xs text-muted"><th class="px-4 py-2">Adresa</th><th class="px-4 py-2">Obsazeno / kvóta</th><th class="px-4 py-2">Stav</th><th class="px-4 py-2">Správa</th></tr></thead>
				<tbody>{#each mail.mailboxes as m (m.address)}
					<tr class="border-t border-line align-top">
						<td class="px-4 py-3"><strong>{m.address}</strong><div class="text-xs text-muted">{m.name}</div></td>
						<td class="px-4 py-3 whitespace-nowrap">{mib(m.usedBytes)} / {mib(m.quotaBytes)} MiB<div class="text-xs text-muted">{m.messages} zpráv</div></td>
						<td class="px-4 py-3"><Pill tone={m.active ? 'ok' : 'off'}>{m.active ? 'Zapnutá' : 'Pozastavená'}</Pill></td>
						<td class="px-4 py-3">
							<form method="POST" action="?/state" use:enhance={keepResult()}><input type="hidden" name="address" value={m.address} /><input type="hidden" name="active" value={m.active ? 'false' : 'true'} /><Button size="sm" type="submit" variant="secondary">{m.active ? 'Pozastavit' : 'Zapnout'}</Button></form>
							<details class="mt-2"><summary class="cursor-pointer text-xs underline">Změnit heslo nebo kvótu</summary>
								<form method="POST" action="?/password" use:enhance={keepResult({ reset: true })} class="mt-3 flex max-w-sm flex-col gap-2"><input type="hidden" name="address" value={m.address} /><label class="label" for="password-{m.address}">Nové heslo</label><input class="input" id="password-{m.address}" name="password" type="password" autocomplete="new-password" minlength="12" maxlength="128" required /><Button type="submit" size="sm">Změnit heslo</Button></form>
								<form method="POST" action="?/quota" use:enhance={keepResult()} class="mt-3 flex max-w-sm flex-col gap-2"><input type="hidden" name="address" value={m.address} /><label class="label" for="quota-{m.address}">Kvóta (MiB)</label><input class="input" id="quota-{m.address}" name="quota" type="number" min="16" max="2048" value={mib(m.quotaBytes)} required /><Button type="submit" size="sm">Uložit kvótu</Button></form>
							</details>
						</td>
					</tr>
				{/each}</tbody>
			</table></div>
		{:else}<Empty title="Zatím žádné schránky">Každé schránce nastavte vlastní heslo. Zprávy ze starého VPS se samy nepřenesou.</Empty>{/if}
		{#if mail.domains.length}
			<details class="border-t border-line p-4"><summary class="cursor-pointer text-sm font-semibold">Přidat schránku</summary>
				<form method="POST" action="?/mailbox" use:enhance={keepResult({ reset: true })} class="mt-4 grid max-w-3xl gap-3 sm:grid-cols-2">
					<Field label="Část před @" id="localPart"><input class="input" id="localPart" name="localPart" required maxlength="64" placeholder="info" /></Field>
					<Field label="Doména" id="mailbox-domain"><select class="input" id="mailbox-domain" name="domain" required>{#each mail.domains.filter((d) => d.active) as d}<option value={d.domain}>{d.domain}</option>{/each}</select></Field>
					<Field label="Jméno" id="mailbox-name"><input class="input" id="mailbox-name" name="name" maxlength="100" /></Field>
					<Field label="Kvóta (MiB)" id="mailbox-quota"><input class="input" id="mailbox-quota" name="quota" type="number" min="16" max="2048" value="512" required /></Field>
					<Field label="Heslo (alespoň 12 znaků)" id="mailbox-password"><input class="input" id="mailbox-password" name="password" type="password" autocomplete="new-password" minlength="12" maxlength="128" required /></Field>
					<div class="self-end"><Button type="submit">Založit schránku</Button></div>
				</form>
			</details>
		{/if}
	</Panel>

	<Panel title="Přesměrování" class="mt-5" flush>
		{#if mail.aliases.length}
			<ul class="divide-y divide-line">{#each mail.aliases as a}<li class="flex flex-wrap gap-x-4 gap-y-1 px-4 py-3 text-sm"><strong>{a.address}</strong><span>→ {a.destination}</span><span class="text-muted">{a.active ? 'Zapnuté' : 'Pozastavené'}</span></li>{/each}</ul>
		{:else}<Empty title="Zatím žádná přesměrování" />{/if}
		{#if mail.domains.length}
			<details class="border-t border-line p-4"><summary class="cursor-pointer text-sm font-semibold">Přidat přesměrování</summary>
				<form method="POST" action="?/alias" use:enhance={keepResult({ reset: true })} class="mt-4 grid max-w-3xl gap-3 sm:grid-cols-2">
					<Field label="Adresa na poštovní doméně" id="alias-address"><input class="input" id="alias-address" name="address" type="email" required /></Field>
					<Field label="Cílová adresa" id="alias-destination"><input class="input" id="alias-destination" name="destination" type="email" required /></Field>
					<div><Button type="submit">Založit přesměrování</Button></div>
				</form>
			</details>
		{/if}
	</Panel>
{/if}
