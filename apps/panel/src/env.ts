import { defineEnvVars } from '@sveltejs/kit/env';
import { z } from 'zod';

const optional = z.string().optional().default('');

// Every variable here must also be documented in .env.example.
export const variables = defineEnvVars({
	DATABASE_URL: { schema: z.url(), description: 'MySQL connection string for the panel database.' },
	ORIGIN: { schema: z.url(), description: 'Public URL of the panel, used in invite links and e-mails.' },
	PUBLIC_WEB_ORIGIN: {
		schema: z.url(),
		description: 'Origin of the servero.cz storefront allowed to POST /api/orders.'
	},
	BROKER_SOCKET: { schema: optional, description: 'Unix socket of the root broker. Empty disables server operations.' },
	PROMETHEUS_URL: { schema: optional, description: 'Prometheus HTTP API base URL. Empty hides metrics.' },
	PROBES_FILE: { schema: optional, description: 'Path where blackbox probe targets are written for Alloy.' },
	GRAFANA_URL: { schema: optional, description: 'Public Grafana URL linked from the admin.' },
	CLOUDPANEL_URL: {
		schema: optional,
		description: 'Base URL of the CloudPanel admin used for one-click autologin. Empty hides the CloudPanel button.'
	},
	SMTP_URL: { schema: optional, description: 'nodemailer SMTP URL. Empty logs e-mails to stdout instead.' },
	MAIL_FROM: { schema: optional, description: 'Sender address for panel e-mails.' },
	ORDER_NOTIFY_EMAIL: { schema: optional, description: 'Team inbox notified about new orders.' },
	TURNSTILE_SECRET: { schema: optional, description: 'Cloudflare Turnstile secret. Empty skips the captcha check.' }
});
