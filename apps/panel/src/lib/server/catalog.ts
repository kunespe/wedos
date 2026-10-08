import { asc, eq } from 'drizzle-orm';
import { db } from './db';
import { plans } from './db/schema';

export type Plan = typeof plans.$inferSelect;

export const activePlans = () => db.select().from(plans).where(eq(plans.active, true)).orderBy(asc(plans.sort));
export const allPlans = () => db.select().from(plans).orderBy(asc(plans.sort));

export async function findPlan(code: string): Promise<Plan | undefined> {
	const [plan] = await db.select().from(plans).where(eq(plans.code, code));
	return plan;
}
