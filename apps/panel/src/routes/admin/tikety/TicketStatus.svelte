<script lang="ts">
	import Pill from '#lib/components/Pill.svelte';
	import type { TicketStatus } from '#lib/constants.ts';
	let { status }: { status: TicketStatus } = $props();
	const tone = { open: 'warn', waiting: 'act', closed: 'off' } as const;
	const label = { open: 'Otevřený', waiting: 'Čeká na zákazníka', closed: 'Uzavřený' };
</script>

<Pill tone={tone[status]}>{label[status]}</Pill>
