import { defineEnvVars } from '@sveltejs/kit/env';
import { z } from 'zod';

const optional = z.string().optional().default('');

// Every variable here must also be documented in .env.example.
export const variables = defineEnvVars({
	DATABASE_URL: { schema: z.url(), description: 'MySQL connection string for the panel database.' },
	ORIGIN: { schema: z.url(), description: 'Public URL of the panel, used in invite links and e-mails.' },
	PUBLIC_WEB_ORIGIN: {
		schema: z
			.string()
			.transform((v) => v.split(',').map((o) => o.trim()).filter(Boolean))
			.pipe(z.array(z.url()).min(1)),
		description: 'Storefront origins allowed to call the public APIs (comma-separated; first is the main one).'
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
	MAIL_FROM: { schema: optional, description: 'Sender address for panel e-mails (the SMTP login mailbox).' },
	MAIL_REPLY_TO: { schema: optional, description: 'Reply-To on panel e-mails, so answers reach a person.' },
	ORDER_NOTIFY_EMAIL: { schema: optional, description: 'Team inbox notified about new orders.' },
	TURNSTILE_SECRET: { schema: optional, description: 'Cloudflare Turnstile secret. Empty skips the captcha check.' },
	WEDOS_WAPI_USER: {
		schema: optional,
		description: 'WEDOS account login e-mail for WAPI. Empty disables the WEDOS integration and hides its buttons.'
	},
	WEDOS_WAPI_PASSWORD: {
		schema: optional,
		description: 'WAPI password (not the account password), set in WEDOS admin > WAPI. Secret.'
	},
	WEDOS_WAPI_LIVE: {
		schema: z
			.string()
			.optional()
			.default('0')
			.refine((v) => ['', '0', '1'].includes(v), 'WEDOS_WAPI_LIVE must be 0 or 1')
			.transform((v) => v === '1'),
		description: '1 sends WEDOS changes for real; anything else (default 0) runs them in WAPI test mode.'
	},
	WEDOS_NSSET: { schema: optional, description: 'NSSET handle for .cz registrations. Empty sends WEDOS_DNS instead.' },
	WEDOS_DNS: {
		schema: z
			.string()
			.optional()
			.default('')
			.transform((v) => v.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)),
		description: 'Comma-separated nameservers for new domains without an NSSET. Empty leaves the WEDOS defaults.'
	},
	SUPPLIER_NAME: { schema: optional, description: 'Legal name of the supplier printed on payment requests.' },
	SUPPLIER_ICO: { schema: optional, description: 'Supplier IČO printed on payment requests.' },
	SUPPLIER_DIC: { schema: optional, description: 'Supplier DIČ; empty when not a VAT payer.' },
	SUPPLIER_ADDRESS: { schema: optional, description: 'Supplier registered address for payment requests.' },
	PAYMENT_ACCOUNT: { schema: optional, description: 'Czech bank account for transfers, e.g. 123456789/0800.' },
	PAYMENT_IBAN: {
		schema: z
			.string()
			.optional()
			.default('')
			.transform((v) => v.replace(/\s/g, '').toUpperCase())
			.refine((v) => v === '' || /^CZ\d{22}$/.test(v), 'PAYMENT_IBAN must be a Czech IBAN (CZ + 22 digits)'),
		description: 'IBAN of the same account; used in the QR payment (SPAYD). Empty hides the QR code.'
	},
	VAT_RATE: {
		schema: (v) => {
			const n = Number(v || 0);
			if (![0, 12, 21].includes(n)) throw new Error('VAT_RATE must be 0, 12 or 21');
			return n;
		},
		description: 'VAT percent added to payment requests: 0 while not a VAT payer, 21 once registered.'
	},
	PAYMENT_DUE_DAYS: {
		schema: (v) => {
			const n = Number(v || 14);
			if (!Number.isInteger(n) || n < 1 || n > 60) throw new Error('PAYMENT_DUE_DAYS must be 1-60');
			return n;
		},
		description: 'Days until a payment request is due.'
	}
});
