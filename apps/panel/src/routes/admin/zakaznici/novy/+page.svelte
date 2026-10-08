<script lang="ts">
	import Button from '#lib/components/Button.svelte';
	import PageHeader from '#lib/components/PageHeader.svelte';
	import Panel from '#lib/components/Panel.svelte';
	import CustomerFields from '../CustomerFields.svelte';
	import type { PageProps } from './$types';

	let { form }: PageProps = $props();
</script>

<PageHeader title="Nový zákazník" crumbs={[{ href: '/admin/zakaznici', label: 'Zákazníci' }]}>
	{#snippet meta()}Běžně vzniká převodem objednávky. Ručně jen pro zákazníky domluvené mimo web.{/snippet}
</PageHeader>

<form method="POST" class="max-w-3xl">
	<Panel>
		<CustomerFields values={form?.values} errors={form?.errors ?? {}} />
		<div class="mt-5 flex justify-end"><Button type="submit" variant="primary">Založit</Button></div>
	</Panel>
</form>
