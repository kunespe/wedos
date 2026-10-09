<script lang="ts">
	import { enhance } from '$app/forms';
	import Button from '#lib/components/Button.svelte';
	import FormMessage from '#lib/components/FormMessage.svelte';
	import AuthCard from '../AuthCard.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	let busy = $state(false);
</script>

<AuthCard title="Přihlášení" lead="Klientská zóna a správa služeb SERVEROS.">
	<FormMessage {form} />
	<form
		method="POST"
		class="flex flex-col gap-4"
		use:enhance={() => {
			busy = true;
			return async ({ update }) => {
				await update({ reset: false });
				busy = false;
			};
		}}
	>
		<input type="hidden" name="next" value={data.next} />
		<div>
			<label class="label" for="email">E-mail</label>
			<input class="input" id="email" name="email" type="email" autocomplete="username" required value={form?.email ?? ''} />
		</div>
		<div>
			<label class="label" for="password">Heslo</label>
			<input class="input" id="password" name="password" type="password" autocomplete="current-password" required />
		</div>
		<Button type="submit" variant="primary" disabled={busy}>{busy ? 'Přihlašuji' : 'Přihlásit'}</Button>
	</form>
	<p class="mt-6 text-xs text-muted">
		Přístup posíláme po zřízení služby. Zapomenuté heslo? Napište na
		<a class="underline" href="mailto:info@serveros.cz">info@serveros.cz</a>.
	</p>
</AuthCard>
