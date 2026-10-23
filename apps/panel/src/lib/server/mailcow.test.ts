import { describe, expect, it, vi } from 'vitest';
import { mailcowRequest, mailcowSnapshot, mailcowStatus, updateMailMailbox } from './mailcow.ts';

const config = { url: 'http://127.0.0.1:18080', key: 'private-api-key' };
const fake = (value: unknown) => vi.fn(async () => Response.json(value)) as unknown as typeof fetch;

describe('Mailcow API safety and response handling', () => {
	it('handles HTTP-200 failure envelopes without exposing request bodies or passwords', async () => {
		const fetch = fake([{ type: 'danger', msg: ['password_rejected', 'secret-password'], log: { password: 'secret-password' } }]);
		await expect(updateMailMailbox('info@example.cz', { password: 'secret-password' }, { config, fetch })).rejects.toThrow('Mailcow změnu odmítl');
		try { await mailcowRequest('get/domain/all', undefined, { config, fetch }); } catch (e) { expect(String(e)).not.toContain('secret-password'); }
	});
	it('requires a success envelope for mutations and rejects malformed empty answers', async () => {
		await expect(updateMailMailbox('info@example.cz', { active: false }, { config, fetch: fake([]) })).rejects.toThrow();
		await expect(updateMailMailbox('info@example.cz', { active: false }, { config, fetch: fake([{ type: 'success' }, { type: 'danger' }]) })).rejects.toThrow();
	});
	it('restricts unencrypted HTTP to the local SSH tunnel and refuses URL credentials', async () => {
		const fetch = fake([]);
		for (const url of ['http://mail.example.cz', 'http://127.0.0.1.evil.test', 'https://user:pass@mail.example.cz', 'https://mail.example.cz?key=secret'])
			await expect(mailcowRequest('get/domain/all', undefined, { config: { ...config, url }, fetch })).rejects.toThrow();
		expect(fetch).not.toHaveBeenCalled();
	});
	it('does not follow redirects carrying the API key', async () => {
		const fetch = fake([]);
		await mailcowRequest('get/domain/all', undefined, { config, fetch });
		expect(fetch).toHaveBeenCalledWith(expect.any(URL), expect.objectContaining({ redirect: 'error', headers: expect.objectContaining({ 'X-API-Key': config.key }) }));
		expect(JSON.stringify(mailcowStatus(config))).not.toContain(config.key);
	});
	it('accepts the real empty-object response on a fresh Mailcow installation', async () => {
		expect(await mailcowSnapshot({ config, fetch: fake({}) })).toEqual({ domains: [], mailboxes: [], aliases: [] });
	});
	it('normalizes API quota units and strips unknown sensitive fields', async () => {
		const fetch: typeof globalThis.fetch = vi.fn(async (url: URL) => {
			if (url.pathname.includes('/domain/')) return Response.json([{ domain_name: 'example.cz', active: '1', max_quota_for_domain: 2147483648, max_quota_for_mbox: 536870912, mboxes_in_domain: 1, max_num_mboxes_for_domain: 10, api_key: 'private-key' }]);
			if (url.pathname.includes('/mailbox/')) return Response.json([{ username: 'info@example.cz', active: 1, quota: 536870912, quota_used: 1048576, password: 'private-password', attributes: { private: true } }]);
			return Response.json([]);
		}) as unknown as typeof fetch;
		const snapshot = await mailcowSnapshot({ config, fetch });
		expect(snapshot.domains[0]).toMatchObject({ quotaMiB: 2048, maxMailboxMiB: 512, active: true });
		expect(snapshot.mailboxes[0]).toMatchObject({ quotaBytes: 536870912, usedBytes: 1048576 });
		expect(JSON.stringify(snapshot)).not.toContain('private');
	});
});
