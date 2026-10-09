// Client-safe registry of the official brand marks vendored in src/lib/assets/brands (see SOURCES.md there).
// BrandIcon renders them; the helpers below map what the panel shows (unit names, site and service kinds,
// registrars, providers) to a mark, or null when the thing has no official mark we carry.

/**
 * `dark` says how the mark stays visible on the dark theme:
 * - `ink`: a single-colour mark that is too dark there is drawn in the text colour instead;
 * - `chip`: a mark with its own fixed colours sits on a small light tile.
 */
export type Brand = { title: string; hex: string; file: string; dark?: 'ink' | 'chip' };

export const BRANDS = {
	wordpress: { title: 'WordPress', hex: '#21759B', file: 'wordpress.svg' },
	php: { title: 'PHP', hex: '#777BB4', file: 'php.svg' },
	nodejs: { title: 'Node.js', hex: '#5FA04E', file: 'nodejs.svg' },
	bun: { title: 'Bun', hex: '#000000', file: 'bun.svg', dark: 'ink' },
	mysql: { title: 'MySQL', hex: '#4479A1', file: 'mysql.svg' },
	redis: { title: 'Redis', hex: '#FF4438', file: 'redis.svg' },
	nginx: { title: 'NGINX', hex: '#009639', file: 'nginx.svg' },
	varnish: { title: 'Varnish', hex: '#0072CE', file: 'varnish.svg' },
	cloudpanel: { title: 'CloudPanel', hex: '#1E7AE0', file: 'cloudpanel.svg' },
	grafana: { title: 'Grafana', hex: '#F46800', file: 'grafana.svg' },
	prometheus: { title: 'Prometheus', hex: '#E6522C', file: 'prometheus.svg' },
	loki: { title: 'Grafana Loki', hex: '#F15B2B', file: 'loki.svg' },
	letsencrypt: { title: "Let's Encrypt", hex: '#003A70', file: 'letsencrypt.svg', dark: 'ink' },
	hetzner: { title: 'Hetzner', hex: '#D50C2D', file: 'hetzner.svg' },
	ubuntu: { title: 'Ubuntu', hex: '#E95420', file: 'ubuntu.svg' },
	amazons3: { title: 'Amazon S3', hex: '#E25444', file: 'amazons3.svg' },
	fakturor: { title: 'Fakturor', hex: '#23468A', file: 'fakturor.svg', dark: 'chip' },
	wedos: { title: 'WEDOS', hex: '#234F9F', file: 'wedos.png' },
	subreg: { title: 'Subreg', hex: '#00AEEA', file: 'subreg.png' },
	restic: { title: 'restic', hex: '#000000', file: 'restic.png' }
} as const satisfies Record<string, Brand>;

export type BrandName = keyof typeof BRANDS;

export const isBrand = (name: string): name is BrandName => Object.hasOwn(BRANDS, name);

/** systemd unit (as the broker reports it) to the mark of the software it runs. */
const UNIT_RULES: [RegExp, BrandName][] = [
	[/^clp-/, 'cloudpanel'],
	[/^php[\d.]*-fpm$/, 'php'],
	[/^(mysql|mysqld)$/, 'mysql'],
	[/^redis(-server)?$/, 'redis'],
	[/^nginx$/, 'nginx'],
	[/^varnish(ncsa)?$/, 'varnish'],
	[/^(grafana(-server)?|alloy)$/, 'grafana'],
	[/^loki$/, 'loki'],
	[/^(prometheus|alertmanager)(-.+)?$/, 'prometheus'],
	[/wordpress/, 'wordpress'],
	[/billing-check/, 'fakturor'],
	[/restic/, 'restic']
];

export function unitBrand(unit: string): BrandName | null {
	const name = unit.toLowerCase().replace(/\.(service|timer|socket)$/, '');
	return UNIT_RULES.find(([re]) => re.test(name))?.[1] ?? null;
}

/** A technology by its display name ("Node.js", "nginx", "PHP 8.4", "CloudPanel"). */
export function techBrand(name: string): BrandName | null {
	const key = name.toLowerCase().replace(/[^a-z0-9]/g, '');
	if (key.startsWith('php')) return 'php';
	if (key === 'node' || key === 'nodejs') return 'nodejs';
	if (key === 'nginx' || key === 'nginxmainline') return 'nginx';
	if (key === 'alertmanager' || key === 'alloy') return key === 'alloy' ? 'grafana' : 'prometheus';
	if (key === 'grafanaloki') return 'loki';
	if (key === 's3' || key === 'amazons3' || key === 'aws') return 'amazons3';
	return isBrand(key) ? key : null;
}

/** Site kinds from the broker (ops.ts SITE_KINDS plus CloudPanel's own labels). */
export function siteKindBrand(kind: string): BrandName | null {
	switch (kind.toLowerCase()) {
		case 'wordpress':
			return 'wordpress';
		case 'php':
			return 'php';
		case 'nodejs':
		case 'node.js':
			return 'nodejs';
		case 'bun':
			return 'bun';
		default:
			return null;
	}
}

/** Service kinds (constants.ts SERVICE_KINDS). An app runs on Node.js unless its runtime says Bun. */
export function serviceKindBrand(kind: string, runtime?: string | null): BrandName | null {
	if (kind === 'wp') return 'wordpress';
	if (kind === 'web') return 'php';
	if (kind === 'app') return runtime?.toLowerCase() === 'bun' ? 'bun' : 'nodejs';
	return null;
}

/** Free-text registrar or provider field ("WEDOS", "Subreg", "Hetzner") to its mark. */
export function companyBrand(name: string | null | undefined): BrandName | null {
	const n = (name ?? '').toLowerCase();
	if (n.includes('wedos')) return 'wedos';
	if (n.includes('subreg')) return 'subreg';
	if (n.includes('hetzner')) return 'hetzner';
	return null;
}
