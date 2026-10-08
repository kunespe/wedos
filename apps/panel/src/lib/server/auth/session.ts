import type { Cookies } from '@sveltejs/kit';
import { and, eq, gt, lt } from 'drizzle-orm';
import { dev } from '$app/env';
import { db } from '../db';
import { sessions, users } from '../db/schema';
import { hashToken, randomToken } from './tokens';

export const SESSION_COOKIE = dev ? 'servero_session' : '__Host-servero_session';
const HOUR = 60 * 60 * 1000;
// Admins can touch customer servers, so their sessions are short.
const LIFETIME = { admin: 12 * HOUR, client: 14 * 24 * HOUR };

export type SessionUser = Pick<
	typeof users.$inferSelect,
	'id' | 'email' | 'name' | 'role' | 'customerId' | 'totpSecret'
>;

export async function createSession(user: SessionUser, ip: string, verified: boolean) {
	const token = randomToken();
	const expiresAt = new Date(Date.now() + LIFETIME[user.role]);
	await db.insert(sessions).values({ id: hashToken(token), userId: user.id, expiresAt, verified, ip });
	return { token, expiresAt };
}

export async function validateSession(token: string) {
	const id = hashToken(token);
	const [row] = await db
		.select({
			session: sessions,
			user: {
				id: users.id,
				email: users.email,
				name: users.name,
				role: users.role,
				customerId: users.customerId,
				totpSecret: users.totpSecret,
				disabled: users.disabled
			}
		})
		.from(sessions)
		.innerJoin(users, eq(sessions.userId, users.id))
		.where(and(eq(sessions.id, id), gt(sessions.expiresAt, new Date())));
	if (!row || row.user.disabled) return null;
	return row;
}

export const markVerified = (token: string) =>
	db.update(sessions).set({ verified: true }).where(eq(sessions.id, hashToken(token)));

export const invalidateSession = (token: string) => db.delete(sessions).where(eq(sessions.id, hashToken(token)));

export const invalidateUserSessions = (userId: number) => db.delete(sessions).where(eq(sessions.userId, userId));

export const purgeExpiredSessions = () => db.delete(sessions).where(lt(sessions.expiresAt, new Date()));

export function setSessionCookie(cookies: Cookies, token: string, expiresAt: Date) {
	cookies.set(SESSION_COOKIE, token, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: !dev,
		expires: expiresAt
	});
}

export const clearSessionCookie = (cookies: Cookies) => cookies.delete(SESSION_COOKIE, { path: '/' });
