<script lang="ts">
	import Pill from '#lib/components/Pill.svelte';
	import { ORDER_STATUS_LABEL } from '#lib/orders.ts';
	import type { OrderStatus } from '#lib/constants.ts';
	let { status }: { status: OrderStatus } = $props();
	const tone = { new: 'warn', contacted: 'act', provisioning: 'act', done: 'ok', cancelled: 'off' } as const;
</script>

<Pill tone={tone[status]}>{ORDER_STATUS_LABEL[status]}</Pill>
