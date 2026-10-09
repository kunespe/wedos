import { desc, eq } from 'drizzle-orm';
import { db } from '#lib/server/db/index.ts';
import { auditLog, users } from '#lib/server/db/schema.ts';
import { requireAdmin } from '#lib/server/guards.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	requireAdmin(event);
	const rows = await db
		.select({
			id: auditLog.id,
			action: auditLog.action,
			subject: auditLog.subject,
			details: auditLog.details,
			ip: auditLog.ip,
			createdAt: auditLog.createdAt,
			actor: users.name,
			actorEmail: users.email
		})
		.from(auditLog)
		.leftJoin(users, eq(auditLog.actorId, users.id))
		.orderBy(desc(auditLog.createdAt), desc(auditLog.id))
		.limit(1000);
	return { rows };
};
