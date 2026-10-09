<script lang="ts">
	import Pill from '#lib/components/Pill.svelte';
	import { SERVICE_STATUS_LABEL } from '#lib/format.ts';
	import type { ServiceStatus } from '#lib/constants.ts';
	let { status }: { status: ServiceStatus } = $props();
	const tone = { pending: 'act', active: 'ok', suspended: 'warn', cancelled: 'off' } as const;
</script>

<Pill tone={tone[status]}>{SERVICE_STATUS_LABEL[status]}</Pill>
