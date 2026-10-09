<script lang="ts">
	import { Mail, Phone } from '@lucide/svelte';
	import Panel from '#lib/components/Panel.svelte';
	import { CONTACT } from './tones.ts';

	let { cta = true }: { cta?: boolean } = $props();
</script>

<Panel title="Kontakt">
	<ul class="flex flex-col gap-2 text-sm">
		<li>
			<a class="flex items-center gap-2 font-semibold hover:underline" href="mailto:{CONTACT.email}">
				<Mail size={15} class="text-muted" />{CONTACT.email}
			</a>
		</li>
		<li>
			<a class="mono flex items-center gap-2 font-medium hover:underline" href="tel:{CONTACT.tel}">
				<Phone size={15} class="text-muted" />{CONTACT.phone}
			</a>
		</li>
	</ul>
	<p class="mt-3 text-xs text-muted">Reakce v pracovní době do pár hodin.</p>
	{#if cta}
		<a class="mt-3 inline-block text-xs font-semibold text-accent hover:underline" href="/app/podpora/novy">Napsat požadavek</a>
	{/if}
</Panel>
