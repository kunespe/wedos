import { eq } from 'drizzle-orm';
import type { Db } from '../db/client.ts';
import { invites } from '../db/schema.ts';
import { hashToken, randomToken } from './tokens.ts';

const DAY = 24 * 60 * 60 * 1000;

/** Creates a single-use link token; older unused tokens for the user stop working. */
export async function createInvite(db: Db, userId: number, purpose: 'invite' | 'reset' = 'invite') {
	const token = randomToken();
	await db.delete(invites).where(eq(invites.userId, userId));
	await db.insert(invites).values({
		id: hashToken(token),
		userId,
		purpose,
		expiresAt: new Date(Date.now() + (purpose === 'invite' ? 7 : 1) * DAY)
	});
	return token;
}

export const inviteUrl = (origin: string, token: string) => `${origin.replace(/\/$/, '')}/pozvanka/${token}`;
