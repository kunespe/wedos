<script lang="ts">
	// Renders `{ message }` / `{ error }` returned from a form action.
	let { form }: { form: { message?: string; error?: string } | null | undefined } = $props();
</script>

{#if form?.error}
	<div role="alert" class="mb-4 rounded-[6px] border border-bad/30 bg-bad-bg px-3 py-2 text-sm font-medium text-bad">
		{form.error}
	</div>
{:else if form?.message}
	<div role="status" class="mb-4 rounded-[6px] border border-ok/30 bg-ok-bg px-3 py-2 text-sm font-medium text-ok">
		{form.message}
	</div>
{/if}
