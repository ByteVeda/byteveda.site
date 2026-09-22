import {
  type EmailAttachment,
  type EmailThread,
  emailAttachments,
  emailThreads,
  getDb,
  inboundMessages,
  outboundMessages,
} from "@byteveda/db";
import { MAIL_WORKSPACES, type MailWorkspace } from "@byteveda/db/constants";
import {
  and,
  desc,
  eq,
  exists,
  gt,
  ilike,
  inArray,
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

/**
 * Which mail the caller may see, and which of it they are looking at.
 *
 * Every read in this module takes one. There is no unscoped version on purpose:
 * an operator with academy-only access must not be able to reach a ByteVeda
 * conversation by editing a URL, and the way to guarantee that is to make the
 * scope impossible to forget rather than to remember it at each call site.
 *
 * `allowed` comes from the session — see `readableWorkspaces` in
 * `lib/auth/roles.ts`. `workspace` is the tab, and it can only ever narrow.
 */
export type MailScope = {
  allowed: readonly MailWorkspace[];
  workspace?: MailWorkspace;
};

/** The workspaces a scope actually resolves to. Empty means "show nothing". */
export function visibleWorkspaces(scope: MailScope): MailWorkspace[] {
  const allowed = MAIL_WORKSPACES.filter((workspace) => scope.allowed.includes(workspace));
  return scope.workspace ? allowed.filter((workspace) => workspace === scope.workspace) : allowed;
}

/** One conversation, as the list needs it. */
export type ThreadSummary = {
  threadKey: string;
  subject: string;
  correspondentEmail: string;
  correspondentName: string | null;
  mailbox: string;
  /** Which business it belongs to. Shown when the list spans more than one. */
  workspace: MailWorkspace;
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
  /** Outbound only, so far. What Resend has of an arriving file stays at Resend. */
  attachments: SentAttachment[];
};

/** A file that went out with a message, without the bytes. */
export type SentAttachment = Pick<EmailAttachment, "id" | "filename" | "contentType" | "byteSize">;

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

export type ListOptions = MailScope & {
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
export async function listThreads(options: ListOptions): Promise<ThreadSummary[]> {
  const { filter = "inbox", query = "", limit = 200 } = options;
  const search = query.trim();

  const workspaces = visibleWorkspaces(options);
  // No workspace to read is not an empty inbox; it is no inbox. Answered here
  // rather than as `where workspace in ()`, which is a round trip to Tokyo to
  // be told what this already knows.
  if (workspaces.length === 0) return [];

  const scoped = and(inArray(emailThreads.workspace, workspaces), FILTERS[filter]) as SQL;

  const rows = await getDb()
    .select({
      threadKey: emailThreads.threadKey,
      subject: emailThreads.subject,
      correspondentEmail: emailThreads.correspondentEmail,
      correspondentName: emailThreads.correspondentName,
      mailbox: emailThreads.mailbox,
      preview: emailThreads.preview,
      workspace: emailThreads.workspace,
      lastMessageAt: emailThreads.lastMessageAt,
      lastInboundAt: emailThreads.lastInboundAt,
      lastOutboundAt: emailThreads.lastOutboundAt,
      readAt: emailThreads.readAt,
      archivedAt: emailThreads.archivedAt,
    })
    .from(emailThreads)
    .where(search ? and(scoped, matching(search)) : scoped)
    .orderBy(desc(emailThreads.lastMessageAt))
    .limit(limit);

  return rows.map((row) => ({
    threadKey: row.threadKey,
    subject: row.subject,
    correspondentEmail: row.correspondentEmail,
    correspondentName: row.correspondentName,
    mailbox: row.mailbox,
    workspace: row.workspace,
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
export async function getConversation(
  threadKey: string,
  scope: MailScope,
): Promise<Conversation | null> {
  const db = getDb();
  const workspaces = visibleWorkspaces({ allowed: scope.allowed });

  if (workspaces.length === 0) return null;

  const [[thread], received, sent, files] = await Promise.all([
    db
      .select()
      .from(emailThreads)
      .where(
        // The workspace is part of the lookup, not a check afterwards. A
        // conversation this operator may not read has to be indistinguishable
        // from one that does not exist — anything else confirms, to somebody
        // guessing thread keys, that it is there.
        and(eq(emailThreads.threadKey, threadKey), inArray(emailThreads.workspace, workspaces)),
      )
      .limit(1),

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

    // What went out with each reply. Metadata only: `content` is a 4MB column,
    // and the thread view renders a filename and a size.
    db
      .select({
        id: emailAttachments.id,
        messageId: emailAttachments.messageId,
        filename: emailAttachments.filename,
        contentType: emailAttachments.contentType,
        byteSize: emailAttachments.byteSize,
      })
      .from(emailAttachments)
      .innerJoin(outboundMessages, eq(emailAttachments.messageId, outboundMessages.id))
      .where(eq(outboundMessages.threadKey, threadKey))
      .orderBy(emailAttachments.createdAt),
  ]);

  if (!thread) return null;

  const attached = new Map<string, SentAttachment[]>();
  for (const file of files) {
    if (!file.messageId) continue;
    const list = attached.get(file.messageId) ?? [];
    list.push({
      id: file.id,
      filename: file.filename,
      contentType: file.contentType,
      byteSize: file.byteSize,
    });
    attached.set(file.messageId, list);
  }

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
        attachments: [],
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
        attachments: attached.get(message.id) ?? [],
      }),
    ),
  ].sort((a, b) => a.at.getTime() - b.at.getTime());

  return { thread, messages };
}

/**
 * Unread conversations, for the badge on the rail. Archived ones do not count.
 *
 * Scoped like everything else: the badge has to agree with the list it links
 * to, and an operator who cannot read the academy's mail must not be told there
 * are three of them.
 */
export async function countUnread(scope: MailScope): Promise<number> {
  const workspaces = visibleWorkspaces(scope);
  if (workspaces.length === 0) return 0;

  const [row] = await getDb()
    .select({ total: sql<number>`count(*)::int` })
    .from(emailThreads)
    .where(and(inArray(emailThreads.workspace, workspaces), FILTERS.unread));

  return row?.total ?? 0;
}

export type ThreadCounts = Record<ThreadFilter, number>;

const NO_THREADS: ThreadCounts = { inbox: 0, unread: 0, archived: 0 };

/** What each filter would show, in one pass rather than three. */
export async function countThreads(scope: MailScope): Promise<ThreadCounts> {
  const workspaces = visibleWorkspaces(scope);
  if (workspaces.length === 0) return NO_THREADS;

  const [row] = await getDb()
    .select({
      inbox: sql<number>`count(*) filter (where ${emailThreads.archivedAt} is null)::int`,
      unread: sql<number>`count(*) filter (where ${FILTERS.unread})::int`,
      archived: sql<number>`count(*) filter (where ${emailThreads.archivedAt} is not null)::int`,
    })
    .from(emailThreads)
    .where(inArray(emailThreads.workspace, workspaces));

  return { inbox: row?.inbox ?? 0, unread: row?.unread ?? 0, archived: row?.archived ?? 0 };
}

/** What the workspace tabs badge: how much mail each one is holding. */
export type WorkspaceCounts = Record<MailWorkspace, { inbox: number; unread: number }>;

/**
 * Per-workspace totals, in one grouped pass rather than a query per tab.
 *
 * Every workspace the operator may read appears in the result, including the
 * ones with nothing in them — a tab that vanishes when its inbox empties is a
 * tab that moves under the cursor.
 */
export async function countWorkspaces(scope: MailScope): Promise<WorkspaceCounts> {
  const workspaces = visibleWorkspaces({ allowed: scope.allowed });

  const empty = Object.fromEntries(
    workspaces.map((workspace) => [workspace, { inbox: 0, unread: 0 }]),
  ) as WorkspaceCounts;

  if (workspaces.length === 0) return empty;

  const rows = await getDb()
    .select({
      workspace: emailThreads.workspace,
      inbox: sql<number>`count(*) filter (where ${emailThreads.archivedAt} is null)::int`,
      unread: sql<number>`count(*) filter (where ${FILTERS.unread})::int`,
    })
    .from(emailThreads)
    .where(inArray(emailThreads.workspace, workspaces))
    .groupBy(emailThreads.workspace);

  for (const row of rows) {
    empty[row.workspace] = { inbox: row.inbox, unread: row.unread };
  }

  return empty;
}

/** One address the console may send as, and whose mail it is. */
export type SendableAddress = { email: string; workspace: MailWorkspace };

/**
 * The addresses a new message may be sent from.
 *
 * Taken from the mailboxes that have actually received mail rather than from a
 * list somebody maintains, because that is the same thing as "verified": every
 * address here arrived through Resend's inbound routing, which only accepts
 * mail for domains Resend has already been given. A hand-kept list would be a
 * second place to be wrong, and the failure — a send refused by the API long
 * after the operator has written the message — is the annoying kind.
 *
 * Scoped like every other read here. Somebody with the academy's mail is
 * offered the academy's addresses and cannot send as ByteVeda by editing a
 * form, because the action checks this same list again.
 */
export async function listSendableAddresses(scope: MailScope): Promise<SendableAddress[]> {
  const workspaces = visibleWorkspaces(scope);
  if (workspaces.length === 0) return [];

  const rows = await getDb()
    .selectDistinct({ email: emailThreads.mailbox, workspace: emailThreads.workspace })
    .from(emailThreads)
    .where(and(inArray(emailThreads.workspace, workspaces), isNotNull(emailThreads.mailbox)))
    .orderBy(emailThreads.mailbox);

  return rows.filter((row) => row.email.includes("@"));
}
