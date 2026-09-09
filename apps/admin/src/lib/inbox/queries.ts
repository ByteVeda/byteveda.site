import { getDb, type InboundMessage, inboundMessages } from "@byteveda/db";
import { desc, eq, isNull, sql } from "drizzle-orm";

export type Thread = {
  threadKey: string;
  subject: string;
  fromEmail: string;
  fromName: string | null;
  preview: string;
  messageCount: number;
  unreadCount: number;
  lastReceivedAt: Date;
  repliedAt: Date | null;
};

/**
 * One row per conversation, newest first.
 *
 * Grouped in SQL rather than by loading every message: the inbox only needs the
 * latest line of each thread, and the bodies are the large part.
 */
export async function listThreads(limit = 100): Promise<Thread[]> {
  const rows = await getDb()
    .select({
      threadKey: inboundMessages.threadKey,
      subject: sql<string>`(array_agg(${inboundMessages.subject} order by ${inboundMessages.receivedAt} desc))[1]`,
      fromEmail: sql<string>`(array_agg(${inboundMessages.fromEmail} order by ${inboundMessages.receivedAt} desc))[1]`,
      fromName: sql<
        string | null
      >`(array_agg(${inboundMessages.fromName} order by ${inboundMessages.receivedAt} desc))[1]`,
      preview: sql<string>`left((array_agg(${inboundMessages.text} order by ${inboundMessages.receivedAt} desc))[1], 160)`,
      messageCount: sql<number>`count(*)::int`,
      unreadCount: sql<number>`count(*) filter (where ${inboundMessages.readAt} is null)::int`,
      lastReceivedAt: sql<Date>`max(${inboundMessages.receivedAt})`,
      repliedAt: sql<Date | null>`max(${inboundMessages.repliedAt})`,
    })
    .from(inboundMessages)
    .groupBy(inboundMessages.threadKey)
    .orderBy(desc(sql`max(${inboundMessages.receivedAt})`))
    .limit(limit);

  return rows.map((row) => ({
    ...row,
    lastReceivedAt: new Date(row.lastReceivedAt),
    repliedAt: row.repliedAt ? new Date(row.repliedAt) : null,
  }));
}

export async function getThread(threadKey: string): Promise<InboundMessage[]> {
  return getDb()
    .select()
    .from(inboundMessages)
    .where(eq(inboundMessages.threadKey, threadKey))
    .orderBy(inboundMessages.receivedAt);
}

export async function countUnread(): Promise<number> {
  const [row] = await getDb()
    .select({ total: sql<number>`count(*)::int` })
    .from(inboundMessages)
    .where(isNull(inboundMessages.readAt));

  return row?.total ?? 0;
}
