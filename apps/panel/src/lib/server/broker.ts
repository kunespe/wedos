import { createConnection } from 'node:net';
import { BROKER_SOCKET } from '$app/env/private';

export class BrokerError extends Error {}

export const brokerEnabled = () => BROKER_SOCKET !== '';

const MAX_RESPONSE = 4_000_000;

/**
 * Talks to dashboard/broker.py: one JSON line in, one JSON line out.
 * The broker owns every privileged operation; the panel only ever names one.
 */
export function broker<T = unknown>(op: string, data: Record<string, unknown> = {}, socketPath = BROKER_SOCKET): Promise<T> {
	if (!socketPath) return Promise.reject(new BrokerError('Serverové operace nejsou v tomto prostředí zapnuté.'));
	const timeout = op === 'create_site' ? 300_000 : 30_000;
	return new Promise((resolve, reject) => {
		const socket = createConnection(socketPath);
		let buffer = '';
		socket.setTimeout(timeout, () => socket.destroy(new BrokerError('Provozní služba neodpovídá.')));
		socket.on('connect', () => socket.write(JSON.stringify({ op, data }) + '\n'));
		socket.on('data', (chunk) => {
			buffer += chunk.toString('utf8');
			if (buffer.length > MAX_RESPONSE) socket.destroy(new BrokerError('Odpověď je příliš velká.'));
			if (!buffer.endsWith('\n')) return;
			socket.end();
			try {
				const result = JSON.parse(buffer) as { ok: boolean; data?: T; error?: string };
				if (result.ok) resolve(result.data as T);
				else reject(new BrokerError(result.error ?? 'Operace selhala.'));
			} catch {
				reject(new BrokerError('Neplatná odpověď provozní služby.'));
			}
		});
		socket.on('error', (e) =>
			reject(e instanceof BrokerError ? e : new BrokerError('Provozní služba není dostupná.'))
		);
	});
}

/** Shape returned by the broker's `snapshot` op (see dashboard/broker.py snapshot()). */
export interface Snapshot {
	sites: {
		id: number;
		domain_name: string;
		type: string;
		root_directory: string;
		user: string;
		application: string;
		management: {
			client?: string;
			expires_at?: string;
			manual_hold?: boolean;
			kind?: string;
			suspended?: boolean;
			subscription_id?: number | null;
		};
		billing_status: { proposed_action?: string; reason?: string; subscription?: { name: string; expires_on: string } };
	}[];
	wordpress: { domain: string; path: string; version: string; excluded: boolean }[];
	backups: { name: string; storage: string; snapshot: string; path: string; time: number; success: boolean; size: number }[];
	services: Record<string, string>;
	runtimes: { name: string; version: string; installed: boolean }[];
	logs: string;
	events: { time: number; action: string; details: string }[];
	memory_total: number;
	memory_used: number;
	disk_total: number;
	disk_used: number;
	load: [number, number, number];
	uptime: number;
	billing: { enabled: boolean; dry_run: boolean; grace_days: number; api_configured: boolean };
	billing_status: { checked_at?: number; error?: string; subscriptions?: { id: number; name: string; expires_on: string; active: boolean }[] };
	s3_ready: boolean;
	wp_config: { enabled: boolean };
	updates: {
		time: number;
		packages: { name: string; current: string; latest: string }[] | null;
		components: { name: string; current?: string; latest?: string }[];
		errors: string[];
		reboot_required: boolean;
	} | null;
	update_check_running: boolean;
	timestamp: number;
}
