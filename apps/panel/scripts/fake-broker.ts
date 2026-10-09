// Local stand-in for dashboard/broker.py so the admin can be developed and tested without a server.
// Usage: node scripts/fake-broker.ts /tmp/servero-broker.sock   (then BROKER_SOCKET=/tmp/servero-broker.sock)
// Mirrors the real broker's ops, validation rules and error messages; all state lives in memory.
import { createServer } from 'node:net';
import { rmSync } from 'node:fs';

const path = process.argv[2] ?? '/tmp/servero-broker.sock';
const now = () => Date.now() / 1000;
const GB = 1024 ** 3;
const DAY = 86400;
const DOMAIN = /^(?=.{3,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z][a-z0-9-]{1,62}$/;
const KINDS = ['static', 'php', 'wordpress', 'nodejs', 'bun'];
const GRACE_DAYS = 7;

type Management = {
	client?: string;
	expires_at?: string;
	manual_hold?: boolean;
	kind?: string;
	suspended?: boolean;
	subscription_id?: number | null;
	wp_excluded_by_suspension?: boolean;
};
type Site = { id: number; domain_name: string; type: string; root_directory: string; user: string; application: string; management: Management };

const sites: Site[] = [
	{ id: 1, domain_name: 'centrumarete.cz', type: 'php', root_directory: 'centrumarete.cz', user: 'centrumarete', application: 'wordpress', management: { client: 'Centrum Arete', expires_at: '2027-03-31', manual_hold: false, kind: 'wordpress', suspended: false, subscription_id: 101 } },
	{ id: 2, domain_name: 'jrmontaze.cz', type: 'php', root_directory: 'jrmontaze.cz', user: 'jrmontaze', application: 'wordpress', management: { client: 'JR Montáže', expires_at: '2026-09-25', manual_hold: false, kind: 'wordpress', suspended: false, subscription_id: 102 } },
	{ id: 3, domain_name: 'kavarna-u-mostu.cz', type: 'php', root_directory: 'kavarna-u-mostu.cz', user: 'kavarna', application: 'php', management: { client: 'Kavárna U Mostu', expires_at: '2026-12-31', manual_hold: true, kind: 'php', suspended: false, subscription_id: null } },
	{ id: 4, domain_name: 'api.stavby-benes.cz', type: 'nodejs', root_directory: 'api.stavby-benes.cz', user: 'benesapi', application: 'nodejs', management: { client: '', expires_at: '', manual_hold: false, kind: 'nodejs', suspended: false, subscription_id: null } }
];
const wpConfig = { enabled: true, excluded_paths: [] as string[] };
const subscriptions = [
	{ id: 101, name: 'Hosting Centrum Arete', expires_on: '2027-03-31', active: true },
	{ id: 102, name: 'Hosting JR Montáže', expires_on: '2026-09-25', active: true },
	{ id: 103, name: 'Správa serverů Stavby Beneš', expires_on: '2027-01-31', active: true }
];
let checkedAt = now() - 420;
let updateRunningUntil = 0;
let updatesTime = now() - 5 * 3600;
const events: { time: number; action: string; details: string }[] = [
	{ time: now() - 3600, action: 'wordpress_run', details: 'Spuštěna údržba WordPressů' },
	{ time: now() - DAY, action: 'billing_sync', details: 'Fakturor synchronizován; pouze sledování' }
];
// Same shape as broker.py audit(): newest first in the snapshot.
const log = (action: string, details: string) => events.unshift({ time: now(), action, details });

const rootOf = (s: Site) => `/home/${s.user}/htdocs/${s.root_directory}`;

/** fakturor.py normalize(): the first invalid moment is midnight after expires_on in Prague. */
function subscriptionStatus(sub: (typeof subscriptions)[number]) {
	const end = new Date(sub.expires_on + 'T00:00:00+02:00').getTime() / 1000 + DAY;
	const suspendAt = end + GRACE_DAYS * DAY;
	const isExpired = now() >= end;
	return { ...sub, is_expired: isExpired, suspend_at: new Date(suspendAt * 1000).toISOString(), suspend_timestamp: suspendAt, past_grace: isExpired && now() >= suspendAt };
}

/** fakturor.py decision(): proposes, never acts. */
function billingPlan(s: Site) {
	const id = s.management.subscription_id;
	if (!id) return {};
	const raw = subscriptions.find((x) => x.id === id);
	const sub = raw ? subscriptionStatus(raw) : null;
	let action = 'keep',
		reason = 'Současný provozní stav zůstává';
	if (s.management.manual_hold) reason = 'Ruční výjimka z automatického vypínání';
	else if (!sub) (action = 'unknown'), (reason = 'Předplatné nebylo nalezeno; provoz zachován');
	else if (sub.past_grace && !s.management.suspended) (action = 'suspend'), (reason = 'Platnost vypršela a uplynula ochranná lhůta');
	return { subscription_id: id, subscription: sub, proposed_action: action, reason };
}

function snapshot() {
	const wordpress = sites
		.filter((s) => s.application === 'wordpress')
		.map((s) => ({ domain: s.domain_name, path: rootOf(s), version: '6.8.3', excluded: wpConfig.excluded_paths.includes(rootOf(s)) }));
	return {
		sites: sites.map((s) => {
			const billing_status = billingPlan(s);
			const management = { ...s.management };
			if ('subscription' in billing_status && billing_status.subscription) management.expires_at = billing_status.subscription.expires_on;
			return { ...s, management, billing_status };
		}),
		wordpress,
		backups: wordpress.flatMap((w, i) => [
			{ name: `${w.domain}-${1791500000 + i}`, storage: 'Lokální', snapshot: '', path: w.path, time: now() - 6 * 3600 - i * 60, success: i !== 1, size: (0.4 + i * 0.3) * GB },
			{ name: `${w.domain}-${1791400000 + i}`, storage: 'Lokální', snapshot: '', path: w.path, time: now() - 30 * 3600 - i * 60, success: true, size: (0.38 + i * 0.3) * GB }
		]),
		services: {
			...Object.fromEntries(['mysql', 'nginx', 'clp-nginx', 'clp-php-fpm', 'varnish', 'redis-server', 'php8.4-fpm', 'memcached', 'ssh', 'fail2ban', 'cron', 'clp-agent', 'vw-dashboard-broker', 'servero-panel', 'grafana-server', 'prometheus', 'loki', 'alloy', 'alertmanager', 'vytvorit-web-wordpress.timer', 'vw-update-check.timer', 'vw-billing-check.timer'].map((n) => [n, 'active'])),
			'php8.2-fpm': 'inactive',
			'php8.3-fpm': 'inactive',
			'php8.5-fpm': 'activating'
		},
		runtimes: [{ name: 'Node.js', version: 'v24.21.0', installed: true }, { name: 'Bun', version: '1.3.14', installed: true }],
		logs: [
			'2026-10-09T03:30:01+0200 vytvorit-web vytvorit-web-wordpress[41022]: INFO Discovered 2 WordPress sites',
			'2026-10-09T03:30:02+0200 vytvorit-web vytvorit-web-wordpress[41022]: ERROR Update failed for /home/centrumarete/htdocs/centrumarete.cz; inspect backup and site before retrying',
			'2026-10-09T03:30:02+0200 vytvorit-web vytvorit-web-wordpress[41022]: RuntimeError: S3 backup is not configured and verified',
			'2026-10-09T03:30:03+0200 vytvorit-web systemd[1]: vytvorit-web-wordpress.service: Main process exited, code=exited, status=1/FAILURE'
		].join('\n'),
		events: events.slice(0, 60),
		memory_total: 3.7 * GB,
		memory_used: 2.0 * GB,
		disk_total: 38 * GB,
		disk_used: 9.8 * GB,
		load: [0.21, 0.18, 0.15],
		uptime: 3 * DAY + 7200,
		billing: { enabled: false, dry_run: true, grace_days: GRACE_DAYS, api_configured: true },
		billing_status: { checked_at: checkedAt, attempted_at: checkedAt, error: '', dry_run: true, subscriptions: subscriptions.map(subscriptionStatus) },
		s3_ready: false,
		wp_config: { enabled: wpConfig.enabled },
		updates: {
			time: updatesTime,
			packages: [{ name: 'openssl', current: '3.5.1-1ubuntu1', latest: '3.5.1-1ubuntu2' }, { name: 'libssl3t64', current: '3.5.1-1ubuntu1', latest: '3.5.1-1ubuntu2' }],
			components: [
				{ name: 'Node.js', current: 'v24.21.0', latest: 'v24.22.0', status: 'Dostupná aktualizace', note: 'Nejnovější vydání v používané hlavní řadě 24' },
				{ name: 'Bun', current: '1.3.14', latest: '1.3.14', status: 'Aktuální', note: 'Nejnovější stabilní vydání Bunu' },
				{ name: 'nginx', current: '1.28.0', latest: '1.28.0', status: 'Aktuální', note: 'Podle nakonfigurovaných APT repozitářů' }
			],
			wordpress: wordpress.map((w) => ({ path: w.path, status: w.excluded ? 'Vynecháno: pozastavený web nebo výjimka' : 'Ověřeno', core: [], plugins: w.excluded ? [] : [{ name: 'contact-form-7' }], themes: [] })),
			errors: [],
			reboot_required: false
		},
		update_check_running: now() < updateRunningUntil,
		timestamp: now()
	};
}

function webState(data: Record<string, unknown>) {
	const domain = String(data.domain ?? '');
	const site = sites.find((s) => s.domain_name === domain);
	if (!site || !DOMAIN.test(domain)) throw new Error('Web nebyl nalezen');
	const kind = (site.management.kind ?? site.type).toLowerCase();
	if (['bun', 'nodejs', 'node.js', 'reverse proxy', 'reverse-proxy'].includes(kind))
		throw new Error('Pozastavení aplikace vyžaduje nejdřív připojení její běžící služby. Použijte pokročilou správu v CloudPanelu.');
	const suspend = data.suspend === true;
	if (suspend === Boolean(site.management.suspended)) return {};
	site.management.suspended = suspend;
	// Keep scheduled WordPress maintenance from modifying a paused site.
	const root = rootOf(site);
	if (suspend && !wpConfig.excluded_paths.includes(root)) {
		wpConfig.excluded_paths.push(root);
		site.management.wp_excluded_by_suspension = true;
	}
	if (!suspend && site.management.wp_excluded_by_suspension) {
		wpConfig.excluded_paths = wpConfig.excluded_paths.filter((p) => p !== root);
		site.management.wp_excluded_by_suspension = false;
	}
	log(suspend ? 'web_suspend' : 'web_resume', domain);
	return {};
}

function createSite(data: Record<string, unknown>) {
	const domain = String(data.domain ?? '').trim().toLowerCase();
	const kind = String(data.kind ?? '');
	if (!DOMAIN.test(domain) || !KINDS.includes(kind)) throw new Error('Zadejte platnou doménu a typ webu');
	if (sites.some((s) => s.domain_name === domain)) throw new Error('Doména už existuje');
	if (kind === 'nodejs' || kind === 'bun') {
		const port = Number(data.port ?? 3000);
		if (!Number.isInteger(port) || port < 3000 || port > 9999) throw new Error('Port musí být mezi 3000 a 9999');
	}
	const user = 'vw' + Math.random().toString(16).slice(2, 12);
	sites.push({
		id: Math.max(...sites.map((s) => s.id)) + 1,
		domain_name: domain,
		type: kind === 'wordpress' ? 'php' : kind === 'bun' ? 'reverse-proxy' : kind,
		root_directory: domain,
		user,
		application: kind,
		management: { client: '', expires_at: '', manual_hold: false, kind, suspended: false }
	});
	log('site_create', `${domain} (${kind})`);
	const secret = () => Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
	return { user, sftp_password: secret(), ...(kind === 'wordpress' ? { wordpress_password: secret() } : {}) };
}

function hostingSettings(data: Record<string, unknown>) {
	const domain = String(data.domain ?? '');
	const site = sites.find((s) => s.domain_name === domain);
	if (!site) throw new Error('Web nebyl nalezen');
	const expiry = String(data.expires_at ?? '');
	if (expiry && Number.isNaN(Date.parse(expiry))) throw new Error('Neplatné datum');
	const client = String(data.client ?? '').trim();
	if (client.length > 120) throw new Error('Název klienta je příliš dlouhý');
	const rawId = String(data.subscription_id ?? '').trim();
	const subscriptionId = /^\d+$/.test(rawId) && Number(rawId) > 0 ? Number(rawId) : null;
	if (rawId && subscriptionId == null) throw new Error('Neplatné ID předplatného');
	if (subscriptionId) {
		if (!subscriptions.some((x) => x.id === subscriptionId)) throw new Error('Předplatné není v seznamu Fakturoru');
		if (sites.some((s) => s.domain_name !== domain && s.management.subscription_id === subscriptionId))
			throw new Error('Předplatné je již přiřazené jinému webu');
	}
	Object.assign(site.management, { client, expires_at: expiry, subscription_id: subscriptionId, manual_hold: data.manual_hold === true });
	log('hosting_settings', domain);
	return {};
}

function dispatch(op: string, data: Record<string, unknown>) {
	switch (op) {
		case 'snapshot':
			return snapshot();
		case 'billing_sync':
			checkedAt = now();
			log(op, 'Fakturor synchronizován; pouze sledování');
			return { error: '' };
		case 'update_check':
			updateRunningUntil = now() + 8;
			setTimeout(() => (updatesTime = now()), 8000);
			log(op, 'Spuštěna kontrola dostupných aktualizací');
			return {};
		case 'wordpress_run':
			log(op, 'Spuštěna údržba WordPressů');
			return {};
		case 'wordpress_settings':
			wpConfig.enabled = data.enabled === true;
			log(op, 'Automatizace ' + (wpConfig.enabled ? 'zapnuta' : 'vypnuta'));
			return {};
		case 'autologin':
			log('cloudpanel_login', 'Jednorázový vstup do CloudPanelu');
			return { token: 'dev-' + Math.random().toString(16).slice(2) };
		case 'web_state':
			return webState(data);
		case 'create_site':
			return createSite(data);
		case 'hosting_settings':
			return hostingSettings(data);
		default:
			throw new Error('Nepovolená operace');
	}
}

rmSync(path, { force: true });
createServer((socket) => {
	let buf = '';
	socket.on('data', (chunk) => {
		buf += chunk;
		if (!buf.includes('\n')) return;
		let result;
		try {
			const req = JSON.parse(buf);
			result = { ok: true, data: dispatch(req.op, req.data ?? {}) };
		} catch (e) {
			log('error', e instanceof Error ? e.name : 'Error');
			result = { ok: false, error: e instanceof Error ? e.message : 'Operace selhala' };
		}
		socket.end(JSON.stringify(result) + '\n');
	});
}).listen(path, () => console.log('fake broker on', path));
