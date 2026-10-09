import { createServer, type Server } from 'node:net';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { broker, BrokerError } from './broker';

let server: Server;
let dir: string;
let socketPath: string;
const seen: unknown[] = [];

beforeAll(async () => {
	dir = mkdtempSync(join(tmpdir(), 'broker-'));
	socketPath = join(dir, 'b.sock');
	server = createServer((s) => {
		let buf = '';
		s.on('data', (c) => {
			buf += c;
			if (!buf.endsWith('\n')) return;
			const req = JSON.parse(buf);
			seen.push(req);
			// Reply in two chunks to prove the client waits for the newline.
			const reply = req.op === 'snapshot' ? { ok: true, data: { sites: [] } } : { ok: false, error: 'Nepovolená operace' };
			const text = JSON.stringify(reply) + '\n';
			s.write(text.slice(0, 5));
			setTimeout(() => s.end(text.slice(5)), 10);
		});
	});
	await new Promise<void>((r) => server.listen(socketPath, r));
});

afterAll(() => {
	server.close();
	rmSync(dir, { recursive: true, force: true });
});

describe('broker client', () => {
	it('sends one JSON line and parses the reply', async () => {
		await expect(broker('snapshot', {}, socketPath)).resolves.toEqual({ sites: [] });
		expect(seen.at(-1)).toEqual({ op: 'snapshot', data: {} });
	});
	it('turns broker errors into BrokerError', async () => {
		await expect(broker('rm_rf', {}, socketPath)).rejects.toThrow(new BrokerError('Nepovolená operace'));
	});
	it('fails cleanly when the socket is missing', async () => {
		await expect(broker('snapshot', {}, join(dir, 'missing.sock'))).rejects.toBeInstanceOf(BrokerError);
	});
	it('refuses when disabled', async () => {
		await expect(broker('snapshot', {}, '')).rejects.toBeInstanceOf(BrokerError);
	});
});
