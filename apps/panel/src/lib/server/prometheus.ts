import { PROMETHEUS_URL } from '$app/env/private';

export const metricsEnabled = () => PROMETHEUS_URL !== '';

type Vector = { metric: Record<string, string>; value: [number, string] }[];

async function instant(query: string): Promise<Vector> {
	if (!PROMETHEUS_URL) return [];
	try {
		const url = `${PROMETHEUS_URL.replace(/\/$/, '')}/api/v1/query?query=${encodeURIComponent(query)}`;
		const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
		if (!res.ok) return [];
		const body = (await res.json()) as { data?: { result?: Vector } };
		return body.data?.result ?? [];
	} catch {
		return [];
	}
}

export interface ProbeHealth {
	up: boolean | null;
	uptime30d: number | null;
	latencyMs: number | null;
	sslDays: number | null;
}

/**
 * Health per service id. Only ids passed in are queried, so a client never sees another customer's targets.
 */
export async function probeHealth(serviceIds: number[]): Promise<Map<number, ProbeHealth>> {
	const out = new Map<number, ProbeHealth>();
	for (const id of serviceIds) out.set(id, { up: null, uptime30d: null, latencyMs: null, sslDays: null });
	if (!serviceIds.length || !metricsEnabled()) return out;
	const sel = `{service_id=~"${serviceIds.map(Number).join('|')}"}`;
	const [up, uptime, latency, ssl] = await Promise.all([
		instant(`max by (service_id) (probe_success${sel})`),
		instant(`avg by (service_id) (avg_over_time(probe_success${sel}[30d]))`),
		instant(`max by (service_id) (probe_duration_seconds${sel})`),
		instant(`min by (service_id) ((probe_ssl_earliest_cert_expiry${sel} - time()) / 86400)`)
	]);
	const each = (v: Vector, fn: (h: ProbeHealth, n: number) => void) => {
		for (const r of v) {
			const h = out.get(Number(r.metric.service_id));
			if (h) fn(h, Number(r.value[1]));
		}
	};
	each(up, (h, n) => (h.up = n === 1));
	each(uptime, (h, n) => (h.uptime30d = n * 100));
	each(latency, (h, n) => (h.latencyMs = Math.round(n * 1000)));
	each(ssl, (h, n) => (h.sslDays = Math.floor(n)));
	return out;
}
