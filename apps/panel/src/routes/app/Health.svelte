<script lang="ts">
	import Led from '#lib/components/Led.svelte';
	import type { ProbeHealth } from '#lib/server/prometheus.ts';

	let { health, wide = false }: { health: ProbeHealth | undefined; wide?: boolean } = $props();

	const h = $derived(health ?? { up: null, uptime30d: null, latencyMs: null, sslDays: null });
	const uptime = $derived(h.uptime30d == null ? '·' : `${h.uptime30d.toFixed(2).replace('.', ',')} %`);
	const latency = $derived(h.latencyMs == null ? '·' : `${h.latencyMs} ms`);
	const ssl = $derived(h.sslDays == null ? '·' : `${h.sslDays} d`);
	const upLabel = $derived(h.up == null ? 'Bez dat' : h.up ? 'Dostupný' : 'Nedostupný');
</script>

<dl class="grid grid-cols-2 gap-x-3 gap-y-2 text-xs {wide ? 'sm:grid-cols-4' : ''}">
	<div class="min-w-0">
		<dt class="text-muted">Stav webu</dt>
		<dd class="mt-0.5 flex items-center gap-1.5 font-semibold">
			<Led state={h.up == null ? 'off' : h.up ? 'ok' : 'bad'} />
			<span class="truncate">{upLabel}</span>
		</dd>
	</div>
	<div>
		<dt class="text-muted">Dostupnost 30 dní</dt>
		<dd class="mono mt-0.5">{uptime}</dd>
	</div>
	<div>
		<dt class="text-muted">Odezva</dt>
		<dd class="mono mt-0.5">{latency}</dd>
	</div>
	<div>
		<dt class="text-muted">SSL platí</dt>
		<dd class="mono mt-0.5 {h.sslDays != null && h.sslDays < 14 ? 'text-warn' : ''}">{ssl}</dd>
	</div>
</dl>
