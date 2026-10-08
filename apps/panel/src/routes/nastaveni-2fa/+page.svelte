<script lang="ts">
	import Button from '#lib/components/Button.svelte';
	import FormMessage from '#lib/components/FormMessage.svelte';
	import AuthCard from '../AuthCard.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const secret = $derived(new URL(data.uri).searchParams.get('secret') ?? '');
</script>

<AuthCard
	title="Dvoufázové ověření"
	lead={data.required ? 'Správci se bez druhého faktoru nepřihlásí. Naskenujte kód v aplikaci (Google Authenticator, 1Password, Aegis).' : 'Naskenujte kód v ověřovací aplikaci.'}
>
	<FormMessage {form} />
	<div class="flex flex-col gap-5">
		<div class="mx-auto size-48 rounded-[6px] bg-white p-3 [&_svg]:size-full">
			{@html data.qr}
		</div>
		<details class="text-xs text-muted">
			<summary class="cursor-pointer">Nejde naskenovat? Klíč pro ruční zadání</summary>
			<code class="mono mt-2 block break-all text-ink">{secret}</code>
		</details>
		<form method="POST" class="flex flex-col gap-4">
			<div>
				<label class="label" for="code">Kód z aplikace</label>
				<input class="input mono text-center text-lg tracking-[0.4em]" id="code" name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="7" required />
			</div>
			<Button type="submit" variant="primary">Zapnout ověření</Button>
		</form>
	</div>
</AuthCard>
