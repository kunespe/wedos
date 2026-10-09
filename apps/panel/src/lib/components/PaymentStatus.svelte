<script lang="ts">
	// Status pill of a payment request; an unpaid request past its due date reads as overdue.
	import { daysUntil } from '../format';
	import { PAYMENT_STATUS_LABEL } from '../payments';
	import Pill from './Pill.svelte';

	let { status, dueDate }: { status: 'unpaid' | 'paid' | 'cancelled'; dueDate: string } = $props();
	const overdue = $derived(status === 'unpaid' && (daysUntil(dueDate) ?? 0) < 0);
</script>

{#if overdue}
	<Pill tone="bad">Po splatnosti</Pill>
{:else}
	<Pill tone={status === 'paid' ? 'ok' : status === 'unpaid' ? 'warn' : 'off'}>{PAYMENT_STATUS_LABEL[status]}</Pill>
{/if}
