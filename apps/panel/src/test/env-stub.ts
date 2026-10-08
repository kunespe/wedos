// Vitest stand-in for SvelteKit's generated `$app/env/private`: reads the real process env.
const e = process.env;
export const DATABASE_URL = e.DATABASE_URL ?? '';
export const ORIGIN = e.ORIGIN ?? 'http://localhost:5173';
export const PUBLIC_WEB_ORIGIN = e.PUBLIC_WEB_ORIGIN ?? 'http://localhost:4410';
export const BROKER_SOCKET = e.BROKER_SOCKET ?? '';
export const PROMETHEUS_URL = e.PROMETHEUS_URL ?? '';
export const PROBES_FILE = e.PROBES_FILE ?? '';
export const GRAFANA_URL = e.GRAFANA_URL ?? '';
export const SMTP_URL = '';
export const MAIL_FROM = '';
export const ORDER_NOTIFY_EMAIL = '';
export const TURNSTILE_SECRET = '';
export const CLOUDPANEL_URL = e.CLOUDPANEL_URL ?? '';
