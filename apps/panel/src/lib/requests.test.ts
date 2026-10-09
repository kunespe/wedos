import { describe, expect, it } from 'vitest';
import { clientInfoSchema, looksSecret } from './client-info';
import { buildRequest, dnsFqdn, isSshPublicKey, REQUEST_SCHEMAS } from './requests';

const KEY = 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIHk3Zr0dO5n2bX2QvQhJm1y8l0e3Yt8Kc9wq2H1p0a7B jana@notebook';

describe('request schemas', () => {
	it('builds a DNS subject with the full name', () => {
		const d = REQUEST_SCHEMAS.dns.parse({ op: 'add', domain: 'Firma.cz', type: 'A', name: 'www', value: '1.2.3.4', ttl: '3600' });
		const r = buildRequest('dns', d, {});
		expect(r.subject).toBe('DNS: A www.firma.cz → 1.2.3.4');
		expect(r.details).toMatchObject({ type: 'A', name: 'www.firma.cz', value: '1.2.3.4', ttl: '1 hodina' });
	});

	it('rejects a non-IPv4 value for an A record and requires MX priority', () => {
		expect(REQUEST_SCHEMAS.dns.safeParse({ op: 'add', domain: 'firma.cz', type: 'A', name: '', value: 'abc', ttl: '3600' }).success).toBe(false);
		expect(REQUEST_SCHEMAS.dns.safeParse({ op: 'add', domain: 'firma.cz', type: 'MX', name: '', value: 'mx.firma.cz', ttl: '3600' }).success).toBe(false);
	});

	it('accepts public SSH keys, refuses private keys and junk', () => {
		expect(isSshPublicKey(KEY)).toBe(true);
		expect(REQUEST_SCHEMAS.access.safeParse({ service: '1', accessType: 'ssh', sshKey: KEY }).success).toBe(true);
		expect(REQUEST_SCHEMAS.access.safeParse({ service: '1', accessType: 'ssh', sshKey: 'mojeheslo123' }).success).toBe(false);
		expect(REQUEST_SCHEMAS.access.safeParse({ service: '1', accessType: 'ssh', sshKey: '' }).success).toBe(false);
		expect(REQUEST_SCHEMAS.access.safeParse({ service: '1', accessType: 'sftp', sshKey: '-----BEGIN OPENSSH PRIVATE KEY-----' }).success).toBe(false);
		expect(REQUEST_SCHEMAS.access.safeParse({ service: '1', accessType: 'sftp', sshKey: '' }).success).toBe(true);
	});

	it('requires the cancel confirmation', () => {
		const base = { service: '1', date: '2999-01-01', reason: 'Nepotřebujeme' };
		expect(REQUEST_SCHEMAS.cancel.safeParse(base).success).toBe(false);
		expect(REQUEST_SCHEMAS.cancel.safeParse({ ...base, confirm: 'on' }).success).toBe(true);
	});

	it('marks incidents as urgent in the subject', () => {
		const d = REQUEST_SCHEMAS.incident.parse({ service: '1', body: 'Web hází 500\nod rána' });
		expect(buildRequest('incident', d, { serviceLabel: 'Web Plus' }).subject).toBe('NALÉHAVÉ: výpadek Web Plus: Web hází 500');
	});

	it('resolves apex and full names', () => {
		expect(dnsFqdn('@', 'firma.cz')).toBe('firma.cz');
		expect(dnsFqdn('mail.firma.cz', 'firma.cz')).toBe('mail.firma.cz');
	});
});

describe('clientInfoSchema', () => {
	it('drops empty rows and refuses password labels', () => {
		expect(clientInfoSchema.parse([{ label: 'Server', value: '1.2.3.4' }, { label: '', value: '' }])).toHaveLength(1);
		expect(clientInfoSchema.safeParse([{ label: 'Heslo k FTP', value: 'x' }]).success).toBe(false);
		expect(clientInfoSchema.safeParse([{ label: 'Uživatel', value: '' }]).success).toBe(false);
		expect(looksSecret('Password')).toBe(true);
		expect(looksSecret('SFTP port')).toBe(false);
	});
});
