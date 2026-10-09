<script lang="ts">
	import { enhance } from '$app/forms';
	import Button from '#lib/components/Button.svelte';
	import Field from '#lib/components/Field.svelte';
	import { czk } from '#lib/format.ts';
	import { keepResult } from '#lib/forms.ts';
	import type { FieldSpec, RequestDef } from '#lib/requests.ts';
	import type { PageData } from './$types';

	let {
		def,
		data,
		form
	}: { def: RequestDef; data: PageData; form: { values?: Record<string, string>; errors?: Record<string, string> } | null } = $props();

	// Initial values: the failed submit first, then field defaults; the form is re-created per category.
	// svelte-ignore state_referenced_locally
	const initial = form?.values ?? {};
	const errors = $derived(form?.errors ?? {});
	const start = (f: FieldSpec) => initial[f.name] ?? f.defaultValue ?? '';

	const services = $derived(data.services.filter((s) => !def.serviceKinds || def.serviceKinds.includes(s.kind)));
	// svelte-ignore state_referenced_locally
	let serviceId = $state(initial.service ?? (data.preselected && services.some((s) => s.id === data.preselected) ? String(data.preselected) : ''));
	// svelte-ignore state_referenced_locally
	let watched = $state<Record<string, string>>(Object.fromEntries(def.fields.map((f) => [f.name, start(f)])));
	let busy = $state(false);

	const visible = (f: FieldSpec) => !f.showIf || f.showIf.values.includes(watched[f.showIf.field] ?? '');
	const planOptions = $derived.by(() => {
		const s = data.services.find((x) => String(x.id) === serviceId);
		return s ? data.plans.filter((p) => s.plans.includes(p.code)) : [];
	});
	const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Prague' }).format(new Date());
	const err = (k: string) => (errors[k] ? { 'aria-invalid': 'true' as const, 'aria-describedby': `f-${k}-error` } : {});
</script>

<form
	method="POST"
	class="flex flex-col gap-4"
	novalidate
	use:enhance={(input) => {
		busy = true;
		return keepResult({ onDone: () => (busy = false) })(input);
	}}
>
	<input type="hidden" name="category" value={def.key} />

	{#if def.ownSubject}
		<Field label="Předmět" id="f-subject" error={errors.subject}>
			<input
				class="input"
				id="f-subject"
				name="subject"
				required
				maxlength={data.limits.subject}
				value={initial.subject ?? data.subject}
				placeholder={def.key === 'billing' ? 'Například: oprava fakturační adresy' : 'Například: nechodí e-maily z formuláře'}
				{...err('subject')}
			/>
		</Field>
	{/if}

	{#if def.service !== 'none'}
		{#if def.service === 'required' && !services.length}
			<p class="rounded-[6px] bg-surface-2 px-3 py-2 text-sm text-muted">
				Tento požadavek se týká konkrétní služby, ale žádnou vhodnou u nás zatím nemáte. Napište nám raději <a class="underline" href="?typ=general">obecný dotaz</a>.
			</p>
		{:else if services.length}
			<Field
				label={def.service === 'required' ? 'Služba' : 'Služba (nepovinné)'}
				id="f-service"
				error={errors.service}
				hint={def.service === 'optional' ? 'Pomůže nám rychleji najít, kde hledat.' : undefined}
			>
				<select class="input" id="f-service" name="service" bind:value={serviceId} required={def.service === 'required'} {...err('service')}>
					<option value="">{def.service === 'required' ? 'Vyberte službu' : 'Netýká se konkrétní služby'}</option>
					{#each services as s (s.id)}
						<option value={String(s.id)}>{s.label}</option>
					{/each}
				</select>
			</Field>
		{/if}
	{/if}

	{#if def.fields.length}
		<div class="grid gap-4 sm:grid-cols-2">
			{#each def.fields as f (f.name)}
				{#if visible(f)}
					{@const id = `f-${f.name}`}
					{@const wide = f.type === 'textarea' || f.type === 'checkbox' || f.name === 'value' || f.name === 'reason'}
					{#if f.type === 'checkbox'}
						<div class="sm:col-span-2">
							<label class="flex items-start gap-2 text-sm font-medium">
								<input type="checkbox" name={f.name} id={id} class="mt-0.5 size-4 shrink-0" checked={initial[f.name] === 'on'} {...err(f.name)} />
								{f.label}
							</label>
							{#if errors[f.name]}<p id="{id}-error" class="mt-1 text-xs font-medium text-bad">{errors[f.name]}</p>{/if}
						</div>
					{:else}
						<Field label={f.label} {id} error={errors[f.name]} hint={f.hint} class={wide ? 'sm:col-span-2' : ''}>
							{#if f.type === 'select'}
								<select class="input" {id} name={f.name} bind:value={watched[f.name]} {...err(f.name)}>
									{#each f.options ?? [] as o (o.value)}<option value={o.value}>{o.label}</option>{/each}
								</select>
							{:else if f.type === 'domain'}
								{#if data.domains.length}
									<select class="input mono" {id} name={f.name} required value={start(f) || (data.preselectedDomain && data.domains.includes(data.preselectedDomain) ? data.preselectedDomain : data.domains[0])} {...err(f.name)}>
										{#each data.domains as dname (dname)}<option value={dname}>{dname}</option>{/each}
									</select>
								{:else}
									<p class="rounded-[6px] bg-surface-2 px-3 py-2 text-sm text-muted">U nás zatím nemáte žádnou doménu. Napište nám <a class="underline" href="?typ=general">obecný dotaz</a>.</p>
								{/if}
							{:else if f.type === 'plan'}
								<select class="input" {id} name={f.name} required value={start(f)} disabled={!planOptions.length} {...err(f.name)}>
									<option value="">{serviceId ? (planOptions.length ? 'Vyberte tarif' : 'Pro tuto službu nemáme jiný tarif') : 'Nejdřív vyberte službu'}</option>
									{#each planOptions as p (p.code)}
										<option value={p.code}>{p.name} · {p.priceFrom && p.monthly != null ? 'od ' : ''}{czk(p.monthly)}{p.monthly != null ? ' / měs.' : ''}</option>
									{/each}
								</select>
							{:else if f.type === 'textarea'}
								<textarea class="input min-h-28 {f.mono ? 'mono text-xs break-all' : ''}" {id} name={f.name} maxlength={f.max} placeholder={f.placeholder} spellcheck="false" autocomplete="off" {...err(f.name)}>{start(f)}</textarea>
							{:else if f.type === 'date'}
								<input class="input" type="date" {id} name={f.name} min={today} required={f.required} value={start(f)} {...err(f.name)} />
							{:else if f.type === 'datetime'}
								<input class="input" type="datetime-local" {id} name={f.name} max="{today}T23:59" required={f.required} value={start(f)} {...err(f.name)} />
							{:else}
								<input
									class="input {f.mono ? 'mono' : ''}"
									{id}
									name={f.name}
									maxlength={f.max}
									placeholder={f.placeholder}
									required={f.required}
									value={start(f)}
									autocomplete="off"
									{...err(f.name)}
								/>
							{/if}
						</Field>
					{/if}
				{/if}
			{/each}
		</div>
	{/if}

	<Field label={def.bodyLabel + (def.bodyRequired ? '' : ' (nepovinné)')} id="f-body" error={errors.body} hint={def.bodyHint}>
		<textarea class="input {def.bodyRequired ? 'min-h-40' : 'min-h-24'}" id="f-body" name="body" required={def.bodyRequired} maxlength={data.limits.body} {...err('body')}>{initial.body ?? ''}</textarea>
	</Field>

	<div class="flex flex-wrap justify-end gap-2">
		<Button href="/app/podpora" variant="ghost">Zrušit</Button>
		<Button type="submit" variant="primary" disabled={busy}>{busy ? 'Odesílám' : def.urgent ? 'Nahlásit výpadek' : 'Odeslat požadavek'}</Button>
	</div>
</form>
