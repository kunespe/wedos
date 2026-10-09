<script lang="ts">
	// A one-time value (password, invite link) with a copy button; wraps instead of overflowing on phones.
	import CopyButton from './CopyButton.svelte';
	let { label, value }: { label: string; value: string } = $props();
</script>

<div>
	<div class="label">{label}</div>
	<div class="flex items-center gap-2">
		<code class="mono min-w-0 flex-1 rounded-[6px] border border-line bg-surface px-2.5 py-1.5 text-xs break-all select-all">{value}</code>
		<CopyButton {value} />
	</div>
</div>
