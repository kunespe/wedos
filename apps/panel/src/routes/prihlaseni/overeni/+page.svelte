<script lang="ts">
	import Button from '#lib/components/Button.svelte';
	import FormMessage from '#lib/components/FormMessage.svelte';
	import AuthCard from '../../AuthCard.svelte';
	import type { PageProps } from './$types';

	let { form }: PageProps = $props();
</script>

<AuthCard title="Dvoufázové ověření" lead="Zadejte šestimístný kód z ověřovací aplikace.">
	<FormMessage {form} />
	<form method="POST" class="flex flex-col gap-4">
		<div>
			<label class="label" for="code">Kód</label>
			<!-- svelte-ignore a11y_autofocus -->
			<input
				class="input mono text-center text-lg tracking-[0.4em]"
				id="code"
				name="code"
				inputmode="numeric"
				autocomplete="one-time-code"
				pattern="[0-9 ]{'{'}6,7{'}'}"
				maxlength="7"
				required
				autofocus
			/>
		</div>
		<Button type="submit" variant="primary">Ověřit</Button>
	</form>
	<form method="POST" action="/odhlaseni" class="mt-4">
		<button class="text-xs text-muted underline" type="submit">Přihlásit jiný účet</button>
	</form>
</AuthCard>
