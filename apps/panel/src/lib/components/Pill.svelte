<script lang="ts">
	import Led from './Led.svelte';
	type Tone = 'ok' | 'act' | 'warn' | 'bad' | 'off';
	let { tone = 'off', children }: { tone?: Tone; children: import('svelte').Snippet } = $props();
	const bg: Record<Tone, string> = {
		ok: 'bg-ok-bg text-ok',
		act: 'bg-info-bg text-accent',
		warn: 'bg-warn-bg text-warn',
		bad: 'bg-bad-bg text-bad',
		off: 'bg-surface-2 text-muted'
	};
</script>

<span class="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap {bg[tone]}">
	<Led state={tone} pulse={tone === 'act'} />
	{@render children()}
</span>
