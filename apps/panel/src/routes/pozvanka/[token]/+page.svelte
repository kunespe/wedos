<script lang="ts">
	import Button from '#lib/components/Button.svelte';
	import FormMessage from '#lib/components/FormMessage.svelte';
	import AuthCard from '../../AuthCard.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
</script>

<AuthCard
	title={data.purpose === 'invite' ? `Vítejte, ${data.name.split(' ')[0]}` : 'Nové heslo'}
	lead={data.purpose === 'invite' ? 'Nastavte si heslo ke klientské zóně SERVERO.' : 'Zvolte nové heslo k účtu.'}
>
	<FormMessage {form} />
	<form method="POST" class="flex flex-col gap-4">
		<div>
			<span class="label">E-mail</span>
			<div class="mono text-sm">{data.email}</div>
			<input type="email" name="username" value={data.email} autocomplete="username" hidden />
		</div>
		<div>
			<label class="label" for="password">Heslo</label>
			<input class="input" id="password" name="password" type="password" autocomplete="new-password" minlength="12" required aria-describedby="pw-hint" />
			<p id="pw-hint" class="mt-1 text-xs text-muted">Alespoň 12 znaků. Nejlépe věta nebo heslo ze správce hesel.</p>
		</div>
		<div>
			<label class="label" for="confirm">Heslo znovu</label>
			<input class="input" id="confirm" name="confirm" type="password" autocomplete="new-password" minlength="12" required />
		</div>
		<Button type="submit" variant="primary">Uložit a pokračovat</Button>
	</form>
</AuthCard>
