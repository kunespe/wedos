<script lang="ts">
	// Compact list of payment requests for the service, customer and order detail panels.
	import Empty from '#lib/components/Empty.svelte';
	import PaymentStatus from '#lib/components/PaymentStatus.svelte';
	import { czk, date } from '#lib/format.ts';

	type Row = {
		id: number;
		vs: string;
		description: string;
		amount: number;
		dueDate: string;
		status: 'unpaid' | 'paid' | 'cancelled';
		paidAt: Date | null;
		invoiceRef: string;
	};
	let { rows, empty = 'Zatím žádné výzvy' }: { rows: Row[]; empty?: string } = $props();
</script>

{#if rows.length}
	<!-- inline-size containment keeps the truncated rows from widening the surrounding grid column on phones -->
	<ul class="text-sm [contain:inline-size]">
		{#each rows as p (p.id)}
			<li class="border-b border-line last:border-b-0">
				<a href="/admin/platby/{p.id}" class="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-2">
					<span class="min-w-0 flex-1">
						<span class="block truncate">{p.description}</span>
						<span class="mono block truncate text-xs text-muted">
							VS {p.vs} · {p.status === 'paid' ? `zaplaceno ${date(p.paidAt)}${p.invoiceRef ? `, ${p.invoiceRef}` : ''}` : `splatnost ${date(p.dueDate)}`}
						</span>
					</span>
					<span class="mono shrink-0 text-xs">{czk(p.amount)}</span>
					<PaymentStatus status={p.status} dueDate={p.dueDate} />
				</a>
			</li>
		{/each}
	</ul>
{:else}
	<Empty title={empty} />
{/if}
