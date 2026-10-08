<script lang="ts">
	import { ChevronRight } from '@lucide/svelte';
	import Panel from '#lib/components/Panel.svelte';
	import type { ServiceKind, TicketCategory } from '#lib/constants.ts';
	import { REQUESTS } from '#lib/requests.ts';
	import { REQUEST_ICON } from '../../request-icons.ts';

	let { id, kind, hasDomain }: { id: number; kind: ServiceKind; hasDomain: boolean } = $props();

	const KEYS: TicketCategory[] = ['dns', 'database', 'php', 'access', 'restore', 'change_plan', 'cancel'];
	const SHORT: Partial<Record<TicketCategory, string>> = {
		dns: 'Upravit DNS záznam',
		database: 'Založit databázi',
		php: 'Změnit verzi PHP',
		access: 'Přístup SFTP / SSH',
		restore: 'Obnovit ze zálohy',
		change_plan: 'Změnit tarif',
		cancel: 'Zrušit službu'
	};
	const items = $derived(
		KEYS.filter((k) => {
			if (k === 'dns') return hasDomain;
			const kinds = REQUESTS[k].serviceKinds;
			return !kinds || kinds.includes(kind);
		})
	);
</script>

<Panel title="Co můžu udělat" flush>
	<ul>
		{#each items as k (k)}
			{@const Icon = REQUEST_ICON[k]}
			<li class="border-b border-line last:border-b-0">
				<a href="/app/podpora/novy?typ={k}&sluzba={id}" class="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-surface-2 {k === 'cancel' ? 'text-muted' : ''}">
					<Icon size={16} class="shrink-0 {k === 'cancel' ? 'text-muted' : 'text-accent'}" />
					<span class="min-w-0 flex-1 font-semibold">{SHORT[k]}</span>
					<ChevronRight size={15} class="shrink-0 text-muted" />
				</a>
			</li>
		{/each}
	</ul>
	<p class="border-t border-line px-4 py-2.5 text-xs text-muted">Každý požadavek vyřizuje člověk, obvykle do pár hodin.</p>
</Panel>
