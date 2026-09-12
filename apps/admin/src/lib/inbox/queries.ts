import {
  type EmailThread,
  emailThreads,
  getDb,
  inboundMessages,
  outboundMessages,
} from "@byteveda/db";
import {
  and,
  desc,
  eq,
  exists,
  gt,
  ilike,
  isNotNull,
  isNull,
  or,
  type SQL,
  sql,
} from "drizzle-orm";

/**
 * Which conversations the list is showing.
 *
 * Three, not four. "Everything including the archive" sounds useful until you
 * notice it is the state where archiving does nothing, and search inside a
 * chip is easier to predict than search that quietly widens the selection.
 */
export const THREAD_FILTERS = ["inbox", "unread", "archived"] as const;
export type ThreadFilter = (typeof THREAD_FILTERS)[number];

export function isThreadFilter(value: string | undefined): value is ThreadFilter {
  return THREAD_FILTERS.includes(value as ThreadFilter);
}

/** One conversation, as the list needs it. */
export type ThreadSummary = {
  threadKey: string;
  subject: string;
  correspondentEmail: string;
  correspondentName: string | null;
  mailbox: string;
  preview: string;
  lastMessageAt: Date;
  unread: boolean;
  archived: boolean;
  /** Anything has been sent in this conversation. */
  answered: boolean;
  /** The last message was ours, so the preview is our words. */
  weSpokeLast: boolean;
};

/**
 * One message in a conversation, whichever way it went.
 *
 * The two tables have different shapes — an arriving message has a Resend id
 * and headers, a sent one has an error and a kind — so the thread view reads
 * this rather than either of them. `direction` is what it renders from.
 */
export type ThreadMessage = {
  id: string;
  direction: "in" | "out";
  fromEmail: string;
  fromName: string | null;
  toEmail: string;
  text: string;
  html: string | null;
  at: Date;
  /** Inbound only. Names the message at Resend, for the body backfill. */
  resendId: string | null;
  /** Outbound only. Set when the send failed, and worth saying so in the thread. */
  error: string | null;
};

export type Conversation = { thread: EmailThread; messages: ThreadMessage[] };

/**
 * Unread is a comparison, not a flag: their last message being newer than the
 * last time this was opened. A reply arriving in a conversation that was read
 * yesterday makes it unread again without anything having to remember to.
 */
export const UNREAD = or(
  isNull(emailThreads.readAt),
  gt(emailThreads.lastInboundAt, emailThreads.readAt),
) as SQL;

const FILTERS: Record<ThreadFilter, SQL> = {
  inbox: isNull(emailThreads.archivedAt) as SQL,
  unread: and(isNull(emailThreads.archivedAt), UNREAD) as SQL,
  archived: isNotNull(emailThreads.archivedAt) as SQL,
};

/**
 * `%` and `_` are wildcards in LIKE, and a search box is user input.
 *
 * Unescaped, typing `%` matches every conversation — which reads as a broken
 * search rather than as the pattern language leaking through.
 */
function contains(value: string): string {
  return `%${value.replace(/[\\%_]/g, (character) => `\\${character}`)}%`;
}

/**
 * Anything the operator might remember about a conversation.
 *
 * The thread's own columns first, which is an index scan over a few hundred
 * rows. The message bodies are behind `exists` so that the text of a thread is
 * only read for the threads the cheaper predicates did not already match.
 */
function matching(query: string): SQL {
  const pattern = contains(query);
  const db = getDb();

  return or(
    ilike(emailThreads.subject, pattern),
    ilike(emailThreads.correspondentEmail, pattern),
    ilike(emailThreads.correspondentName, pattern),
    ilike(emailThreads.preview, pattern),
    exists(
      db
        .select({ one: sql`1` })
        .from(inboundMessages)
        .where(
          and(
            eq(inboundMessages.threadKey, emailThreads.threadKey),
            ilike(inboundMessages.text, pattern),
          ),
        ),
    ),
    exists(
      db
        .select({ one: sql`1` })
        .from(outboundMessages)
        .where(
          and(
            eq(outboundMessages.threadKey, emailThreads.threadKey),
            ilike(outboundMessages.bodyText, pattern),
          ),
        ),
    ),
  ) as SQL;
}

export type ListOptions = {
  filter?: ThreadFilter;
  /** Free text. Blank means no search. */
  query?: string;
  limit?: number;
};

/**
 * Conversations, newest activity first.
 *
 * One indexed read of one table. Everything the row shows — the subject, who it
 * is with, the last line, whether it was answered — is on the thread, which is
 * the point of the thread existing.
 */
export async function listThreads(options: ListOptions = {}): Promise<ThreadSummary[]> {
  const { filter = "inbox", query = "", limit = 200 } = options;
  const search = query.trim();

  const rows = await getDb()
    .select({
      threadKey: emailThreads.threadKey,
      subject: emailThreads.subject,
      correspondentEmail: emailThreads.correspondentEmail,
      correspondentName: emailThreads.correspondentName,
      mailbox: emailThreads.mailbox,
      preview: emailThreads.preview,
      lastMessageAt: emailThreads.lastMessageAt,
      lastInboundAt: emailThreads.lastInboundAt,
      lastOutboundAt: emailThreads.lastOutboundAt,
      readAt: emailThreads.readAt,
      archivedAt: emailThreads.archivedAt,
    })
    .from(emailThreads)
    .where(search ? and(FILTERS[filter], matching(search)) : FILTERS[filter])
    .orderBy(desc(emailThreads.lastMessageAt))
    .limit(limit);

  return rows.map((row) => ({
    threadKey: row.threadKey,
    subject: row.subject,
    correspondentEmail: row.correspondentEmail,
    correspondentName: row.correspondentName,
    mailbox: row.mailbox,
    preview: row.preview,
    lastMessageAt: row.lastMessageAt,
    unread: isUnread(row),
    archived: row.archivedAt !== null,
    answered: row.lastOutboundAt !== null,
    weSpokeLast:
      row.lastOutboundAt !== null &&
      (row.lastInboundAt === null || row.lastOutboundAt >= row.lastInboundAt),
  }));
}

/** The same rule as `UNREAD`, for a row already in hand. */
function isUnread(row: { readAt: Date | null; lastInboundAt: Date | null }): boolean {
  if (row.lastInboundAt === null) return false;
  return row.readAt === null || row.lastInboundAt > row.readAt;
}

/**
 * One conversation and everything in it.
 *
 * Three reads issued together. The database is in another region, and a round
 * trip spent waiting for the previous one is the largest single cost in
 * rendering this page — see the dashboard layout for the same reasoning.
 */
export async function getConversation(threadKey: string): Promise<Conversation | null> {
  const db = getDb();

  const [[thread], received, sent] = await Promise.all([
    db.select().from(emailThreads).where(eq(emailThreads.threadKey, threadKey)).limit(1),

    db
      .select()
      .from(inboundMessages)
      .where(eq(inboundMessages.threadKey, threadKey))
      .orderBy(inboundMessages.receivedAt),

    db
      .select()
      .from(outboundMessages)
      .where(eq(outboundMessages.threadKey, threadKey))
      .orderBy(outboundMessages.sentAt),
  ]);

  if (!thread) return null;

  const messages: ThreadMessage[] = [
    ...received.map(
      (message): ThreadMessage => ({
        id: message.id,
        direction: "in",
        fromEmail: message.fromEmail,
        fromName: message.fromName,
        toEmail: message.toEmail,
        text: message.text,
        html: message.html,
        at: message.receivedAt,
        resendId: message.resendId,
        error: null,
      }),
    ),
    ...sent.map(
      (message): ThreadMessage => ({
        id: message.id,
        direction: "out",
        fromEmail: message.fromEmail,
        fromName: null,
        toEmail: message.toEmail,
        text: message.bodyText,
        html: message.bodyHtml,
        at: message.sentAt,
        resendId: null,
        error: message.error,
      }),
    ),
  ].sort((a, b) => a.at.getTime() - b.at.getTime());

  return { thread, messages };
}

/** Unread conversations, for the badge on the rail. Archived ones do not count. */
export async function countUnread(): Promise<number> {
  const [row] = await getDb()
    .select({ total: sql<number>`count(*)::int` })
    .from(emailThreads)
    .where(FILTERS.unread);

  return row?.total ?? 0;
}

export type ThreadCounts = Record<ThreadFilter, number>;

/** What each filter would show, in one pass rather than three. */
export async function countThreads(): Promise<ThreadCounts> {
  const [row] = await getDb()
    .select({
      inbox: sql<number>`count(*) filter (where ${emailThreads.archivedAt} is null)::int`,
      unread: sql<number>`count(*) filter (where ${FILTERS.unread})::int`,
      archived: sql<number>`count(*) filter (where ${emailThreads.archivedAt} is not null)::int`,
    })
    .from(emailThreads);

  return { inbox: row?.inbox ?? 0, unread: row?.unread ?? 0, archived: row?.archived ?? 0 };
}
