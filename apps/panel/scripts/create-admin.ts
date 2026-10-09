// Creates an admin account and prints a one-time link to set the password.
// Usage: pnpm admin:create email@servero.cz "Jméno Příjmení"
import { eq } from 'drizzle-orm';
import { createInvite, inviteUrl } from '../src/lib/server/auth/invites.ts';
import { createDb } from '../src/lib/server/db/client.ts';
import { users } from '../src/lib/server/db/schema.ts';

const [email, name] = process.argv.slice(2);
if (!email || !name) throw new Error('Usage: pnpm admin:create <email> "<name>"');
const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is not set');

const { db, pool } = createDb(url);
const normalized = email.trim().toLowerCase();
let [user] = await db.select().from(users).where(eq(users.email, normalized));
if (!user) {
	const [{ id }] = await db.insert(users).values({ email: normalized, name, role: 'admin' }).$returningId();
	[user] = await db.select().from(users).where(eq(users.id, id));
} else if (user.role !== 'admin') {
	throw new Error('This e-mail belongs to a client account.');
}
const token = await createInvite(db, user.id, user.passwordHash ? 'reset' : 'invite');
await pool.end();
console.log(inviteUrl(process.env.ORIGIN ?? 'http://localhost:5190', token));
