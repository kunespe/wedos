import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BRANDS, companyBrand, serviceKindBrand, siteKindBrand, techBrand, unitBrand } from './brands';

describe('brands', () => {
	it('has a vendored file for every brand', () => {
		for (const b of Object.values(BRANDS)) expect(existsSync(new URL(`./assets/brands/${b.file}`, import.meta.url)), b.file).toBe(true);
	});

	it('maps systemd units to the software they run', () => {
		expect(unitBrand('php8.4-fpm')).toBe('php');
		expect(unitBrand('php8.2-fpm.service')).toBe('php');
		expect(unitBrand('clp-php-fpm')).toBe('cloudpanel');
		expect(unitBrand('clp-nginx')).toBe('cloudpanel');
		expect(unitBrand('mysql')).toBe('mysql');
		expect(unitBrand('redis-server')).toBe('redis');
		expect(unitBrand('nginx')).toBe('nginx');
		expect(unitBrand('varnish')).toBe('varnish');
		expect(unitBrand('grafana-server')).toBe('grafana');
		expect(unitBrand('alloy')).toBe('grafana');
		expect(unitBrand('prometheus')).toBe('prometheus');
		expect(unitBrand('alertmanager')).toBe('prometheus');
		expect(unitBrand('prometheus-alertmanager')).toBe('prometheus');
		expect(unitBrand('loki')).toBe('loki');
		expect(unitBrand('vytvorit-web-wordpress.timer')).toBe('wordpress');
		expect(unitBrand('vw-billing-check.timer')).toBe('fakturor');
		for (const plain of ['ssh', 'cron', 'fail2ban', 'memcached', 'vw-dashboard']) expect(unitBrand(plain), plain).toBeNull();
	});

	it('maps technology names, site kinds and service kinds', () => {
		expect(techBrand('Node.js')).toBe('nodejs');
		expect(techBrand('Bun')).toBe('bun');
		expect(techBrand('nginx')).toBe('nginx');
		expect(techBrand('PHP 8.4')).toBe('php');
		expect(techBrand('CloudPanel')).toBe('cloudpanel');
		expect(techBrand('Debian')).toBeNull();
		expect(siteKindBrand('wordpress')).toBe('wordpress');
		expect(siteKindBrand('static')).toBeNull();
		expect(serviceKindBrand('wp')).toBe('wordpress');
		expect(serviceKindBrand('web')).toBe('php');
		expect(serviceKindBrand('app')).toBe('nodejs');
		expect(serviceKindBrand('app', 'bun')).toBe('bun');
		expect(serviceKindBrand('vps')).toBeNull();
	});

	it('recognises registrars and providers in free text', () => {
		expect(companyBrand('WEDOS')).toBe('wedos');
		expect(companyBrand('Subreg')).toBe('subreg');
		expect(companyBrand('Hetzner Cloud')).toBe('hetzner');
		expect(companyBrand('GoDaddy')).toBeNull();
		expect(companyBrand(null)).toBeNull();
	});
});
