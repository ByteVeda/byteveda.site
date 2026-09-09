import { getDb, type Subscriber, type SubscriberStatus, subscribers } from "@byteveda/db";
import { desc, eq, sql } from "drizzle-orm";

export async function listSubscribers(limit = 500): Promise<Subscriber[]> {
  return getDb().select().from(subscribers).orderBy(desc(subscribers.createdAt)).limit(limit);
}

export async function countByStatus(): Promise<Record<SubscriberStatus, number>> {
  const rows = await getDb()
    .select({ status: subscribers.status, total: sql<number>`count(*)::int` })
    .from(subscribers)
    .groupBy(subscribers.status);

  const counts = { pending: 0, active: 0, unsubscribed: 0, bounced: 0 };
  for (const row of rows) counts[row.status] = row.total;
  return counts;
}

/** Who a broadcast goes to: confirmed addresses only, never pending ones. */
export async function activeSubscribers(): Promise<Subscriber[]> {
  return getDb().select().from(subscribers).where(eq(subscribers.status, "active"));
}
