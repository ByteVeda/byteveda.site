/**
 * What a conversation is, before anything has been read out of the database.
 *
 * The types the inbox is described in, the rules that do not need a query to
 * answer, and the shape of its URL. No value import of `@byteveda/db` and no
 * I/O, so the thread list and the composers — all of which run in the browser —
 * can import this without dragging `pg` towards the client bundle. The rows
 * themselves are `queries.ts`.
 */

import type { EmailAttachment, EmailThread } from "@byteveda/db";
import { MAIL_WORKSPACES, type MailWorkspace } from "@byteveda/db/constants";

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
 * Every read in `queries.ts` takes one. There is no unscoped version on
 * purpose: an operator with academy-only access must not be able to reach a
 * ByteVeda conversation by editing a URL, and the way to guarantee that is to
 * make the scope impossible to forget rather than to remember it at each call
 * site.
 *
 * `allowed` comes from the session — see `readableWorkspaces` in
 * `features/auth/model.ts`. `workspace` is the tab, and it can only ever narrow.
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

export type ListOptions = MailScope & {
  filter?: ThreadFilter;
  /** Free text. Blank means no search. */
  query?: string;
  limit?: number;
};

export type ThreadCounts = Record<ThreadFilter, number>;

/** What the workspace tabs badge: how much mail each one is holding. */
export type WorkspaceCounts = Record<MailWorkspace, { inbox: number; unread: number }>;

/** One address the console may send as, and whose mail it is. */
export type SendableAddress = { email: string; workspace: MailWorkspace };

export type InboxParams = {
  thread?: string | null;
  filter?: ThreadFilter;
  query?: string;
  /** Which business's mail. Absent means every one this operator may read. */
  workspace?: MailWorkspace;
};

/**
 * The inbox is its URL.
 *
 * Which conversation is open, which filter is showing and what was searched for
 * are all in the query string, so every one of them survives a reload, a link
 * sent to yourself, and the back button. That only holds if every link carries
 * the other two, which is why nothing builds these by hand.
 *
 * The default filter is left out rather than written as `f=inbox`: the plain
 * `/inbox` is the address of the inbox. The same goes for the workspace —
 * absent is "everything I can read", which is the inbox's own address.
 */
export function inboxHref(params: InboxParams = {}): string {
  const search = new URLSearchParams();

  if (params.workspace) search.set("w", params.workspace);
  if (params.filter && params.filter !== "inbox") search.set("f", params.filter);

  const query = params.query?.trim();
  if (query) search.set("q", query);

  if (params.thread) search.set("t", params.thread);

  const rest = search.toString();
  return rest ? `/inbox?${rest}` : "/inbox";
}

/**
 * The one line of a message that the conversation list shows.
 *
 * Denormalised onto `email_threads` rather than derived per render, so the list
 * is a single index scan instead of a lateral join into two message tables for
 * every row it returns.
 *
 * Everything below runs on a string an unauthenticated sender chose: anyone can
 * email the inbound address. That rules out any pattern whose cost grows faster
 * than the input, which is what the length cap below is really for — see
 * `features/mail/model.ts` for the same reasoning applied to subjects.
 */

/** Characters kept. Two clamped lines in the list, with room for a wide one. */
const PREVIEW_LENGTH = 200;

/**
 * How much HTML is examined to find those characters.
 *
 * A bound, not an estimate. The tag strip below is linear in what it is given,
 * and a mail body has no size limit worth trusting — 4 KB is far more than the
 * opening sentence and turns an unbounded scan into a fixed one.
 */
const HTML_BUDGET = 4096;

/** The entities that actually turn up in the first line of a message. */
const ENTITIES: Record<string, string> = {
  "&nbsp;": " ",
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
};

/**
 * Readable text out of mail HTML.
 *
 * Not a parser and not trying to be one: the result is rendered as text, so the
 * only job is to keep a preview from being a run of tag names. `<script>` and
 * `<style>` go first because their *contents* are not markup, and a preview
 * that opens with a CSS reset is worse than no preview.
 */
function textFromHtml(html: string): string {
  const bounded = html.slice(0, HTML_BUDGET);

  const stripped = bounded
    // Both quantifiers are bounded by the slice above, so the worst case is a
    // fixed multiple of HTML_BUDGET rather than a function of the message.
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, " ")
    .replace(/<[^>]*>/g, " ");

  return stripped.replace(/&[a-z#0-9]{2,6};/gi, (entity) => ENTITIES[entity.toLowerCase()] ?? " ");
}

/**
 * A message reduced to one line.
 *
 * Plain text wins when there is any: it is what the sender wrote, where the
 * HTML is what their client made of it. A message with neither gives an empty
 * string, and the list falls back to showing only the subject.
 */
export function previewOf(text: string, html?: string | null): string {
  const source = text.trim() || textFromHtml(html ?? "");

  return source.replace(/\s+/g, " ").trim().slice(0, PREVIEW_LENGTH);
}
