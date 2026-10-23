import { describe, expect, it, vi } from 'vitest';

vi.mock('#lib/server/audit.ts', () => ({ audit: vi.fn() }));
vi.mock('#lib/server/mailcow.ts', () => ({
	createMailAlias: vi.fn(), createMailDomain: vi.fn(), createMailMailbox: vi.fn(),
	mailcowSnapshot: vi.fn(), mailcowStatus: vi.fn(), MailcowError: class extends Error {},
	mailDomain: {}, mailDomainDns: vi.fn(), mailboxAddress: {}, mailboxPassword: {}, mailboxQuota: {}, localPart: {}, updateMailMailbox: vi.fn()
}));
import { actions, load } from '../../routes/admin/posta/+page.server.ts';
import { mailcowSnapshot } from './mailcow.ts';

describe('mail administration access', () => {
	for (const user of [null, { role: 'client', customerId: 1 }]) {
		it(`rejects ${user ? 'customers' : 'anonymous visitors'} before reading form data or calling Mailcow`, async () => {
			const formData = vi.fn();
			const event = { locals: { user }, url: new URL('https://panel.example.cz/admin/posta'), request: { formData } } as never;
			await expect(load(event)).rejects.toMatchObject(user ? { status: 403 } : { status: 303 });
			for (const action of Object.values(actions)) await expect(action!(event)).rejects.toMatchObject(user ? { status: 403 } : { status: 303 });
			expect(formData).not.toHaveBeenCalled();
			expect(mailcowSnapshot).not.toHaveBeenCalled();
		});
	}
});
