import { PROMETHEUS_URL } from '$app/env/private';

/**
 * Public service status for /stav and /stav.json. Aggregates only: every query collapses
 * customer series with avg/min/max, so no domain, service id or customer id ever leaves here.
 */

export type ComponentState = 'ok' | 'degraded' | 'down' | 'unknown';
export type Overall = 'ok' | 'partial' | 'outage' | 'unknown' | 'pending';

export interface StatusDay {
	/** Prague calendar date (YYYY-MM-DD) the 24 h window ends on. */
	date: string;
	/** Availability in percent, null when nothing was measured. */
	uptime: number | null;
}

export interface StatusComponent {
	id: string;
	name: string;
	note: string;
	state: ComponentState;
	/** Current availability in percent (share of probes up), null when unknown. */
	current: number | null;
	/** Average over the measured days of the last 90, null when none. */
	uptime90: number | null;
	days: StatusDay[];
}

export interface PublicStatus {
	enabled: boolean;
	overall: Overall;
	generatedAt: string;
	components: StatusComponent[];
	/** Worst component per day; drives the storefront bars. */
	days: StatusDay[];
	/** Days under the threshold, newest first. */
	incidents: { date: string; component: string; uptime: number }[];
}

export const DAYS = 90;
export const THRESHOLD = 99.9;
const DAY = 86_400;

interface ComponentDef {
	id: string;
	name: string;
	note: string;
	/** Fraction 0..1 now. */
	now: string;
	/** Fraction 0..1 over the 24 h before each evaluation step. */
	daily: string;
	/** Is a total failure of this component an outage of the whole service? */
	critical: boolean;
}

const WEB = 'probe_success{job="blackbox",probe_module="http_2xx"}';
const STACK = 'up{job=~"prometheus|alloy|alertmanager|grafana|loki"}';

export const COMPONENTS: ComponentDef[] = [
	{
		id: 'weby',
		name: 'Weby zákazníků',
		note: 'Podíl webů, které odpovídají na HTTPS',
		now: `avg(${WEB})`,
		daily: `avg(avg_over_time(${WEB}[1d]))`,
		critical: true
	},
	{
		id: 'panel',
		name: 'Klientský panel',
		note: 'panel.servero.cz',
		now: 'max(up{job="servero-panel"})',
		daily: 'max(avg_over_time(up{job="servero-panel"}[1d]))',
		critical: false
	},
	{
		id: 'server',
		name: 'Server vytvorit-web',
		note: 'Webový server v datacentru',
		now: 'max(up{job="node"})',
		daily: 'max(avg_over_time(up{job="node"}[1d]))',
		critical: true
	},
	{
		id: 'monitoring',
		name: 'Monitoring',
		note: 'Dohled, upozornění a logy',
		now: `avg(${STACK})`,
		daily: `avg(avg_over_time(${STACK}[1d]))`,
		critical: false
	}
];

const pragueDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Prague', year: 'numeric', month: '2-digit', day: '2-digit' });
const round = (n: number) => Math.round(n * 1000) / 1000;

/** Step timestamps (seconds) for the last `DAYS` days, oldest first, ending at `end`. */
export function steps(end: number): number[] {
	return Array.from({ length: DAYS }, (_, i) => end - (DAYS - 1 - i) * DAY);
}

/** Range result values -> one entry per step, null where Prometheus had no sample. */
export function toDays(values: [number, string][], end: number): StatusDay[] {
	const byTs = new Map(values.map(([t, v]) => [Math.round(t), Number(v)]));
	return steps(end).map((t) => {
		const v = byTs.get(t);
		return { date: pragueDate.format(new Date(t * 1000)), uptime: v === undefined || !Number.isFinite(v) ? null : round(v * 100) };
	});
}

export function componentState(current: number | null): ComponentState {
	if (current === null) return 'unknown';
	if (current >= THRESHOLD) return 'ok';
	if (current > 50) return 'degraded';
	return 'down';
}

export function overallState(components: Pick<StatusComponent, 'state' | 'id'>[]): Overall {
	if (components.every((c) => c.state === 'unknown')) return 'unknown';
	const critical = new Set(COMPONENTS.filter((c) => c.critical).map((c) => c.id));
	if (components.some((c) => c.state === 'down' && critical.has(c.id))) return 'outage';
	if (components.some((c) => c.state === 'down' || c.state === 'degraded')) return 'partial';
	return 'ok';
}

/** Assembles the public payload from per-component current values and daily series. */
export function assemble(
	parts: { def: Pick<ComponentDef, 'id' | 'name' | 'note'>; current: number | null; days: StatusDay[] }[],
	generatedAt: Date
): PublicStatus {
	const components: StatusComponent[] = parts.map(({ def, current, days }) => {
		const measured = days.filter((d) => d.uptime !== null).map((d) => d.uptime as number);
		return {
			id: def.id,
			name: def.name,
			note: def.note,
			state: componentState(current),
			current,
			uptime90: measured.length ? round(measured.reduce((a, b) => a + b, 0) / measured.length) : null,
			days
		};
	});
	const days: StatusDay[] = (components[0]?.days ?? []).map((d, i) => {
		const vals = components.map((c) => c.days[i]?.uptime).filter((v): v is number => v !== null && v !== undefined);
		return { date: d.date, uptime: vals.length ? Math.min(...vals) : null };
	});
	const incidents = components
		.flatMap((c) => c.days.filter((d) => d.uptime !== null && d.uptime < THRESHOLD).map((d) => ({ date: d.date, component: c.name, uptime: d.uptime as number })))
		.sort((a, b) => b.date.localeCompare(a.date));
	return { enabled: true, overall: overallState(components), generatedAt: generatedAt.toISOString(), components, days, incidents };
}

type PromValue = [number, string];

async function prom<T>(path: string, params: Record<string, string>): Promise<T[]> {
	try {
		const url = `${PROMETHEUS_URL.replace(/\/$/, '')}/api/v1/${path}?${new URLSearchParams(params)}`;
		const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
		if (!res.ok) return [];
		const body = (await res.json()) as { data?: { result?: T[] } };
		return body.data?.result ?? [];
	} catch {
		return [];
	}
}

async function measure(): Promise<PublicStatus> {
	const now = new Date();
	if (!PROMETHEUS_URL) {
		return { enabled: false, overall: 'pending', generatedAt: now.toISOString(), components: [], days: [], incidents: [] };
	}
	const end = Math.floor(now.getTime() / 1000 / 60) * 60;
	const start = end - (DAYS - 1) * DAY;
	const parts = await Promise.all(
		COMPONENTS.map(async (def) => {
			const [instant, range] = await Promise.all([
				prom<{ value: PromValue }>('query', { query: def.now, time: String(end) }),
				prom<{ values: PromValue[] }>('query_range', { query: def.daily, start: String(start), end: String(end), step: String(DAY) })
			]);
			const v = instant[0] ? Number(instant[0].value[1]) : NaN;
			return { def, current: Number.isFinite(v) ? round(v * 100) : null, days: toDays(range[0]?.values ?? [], end) };
		})
	);
	return assemble(parts, now);
}

// One Prometheus round per minute no matter how many visitors; concurrent callers share it.
const TTL = 60_000;
let cache: { at: number; value: Promise<PublicStatus> } | null = null;

export function publicStatus(): Promise<PublicStatus> {
	if (!cache || Date.now() - cache.at > TTL) {
		const value = measure();
		cache = { at: Date.now(), value };
		value.catch(() => (cache = null));
	}
	return cache.value;
}
