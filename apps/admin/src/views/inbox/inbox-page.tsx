import type { MailWorkspace } from "@byteveda/db/constants";
import { ArrowLeft, MoveRight, Paperclip, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { InboxAutoRefresh, LocalTime, PageHeader } from "@/components";
import { can, readableWorkspaces, requirePermission } from "@/features/auth";
import { bodyMissing, isMailWorkspace } from "@/features/mail";
import { listStaged } from "@/lib/attachments/store";
import { formatBytes, maxFileBytes } from "@/lib/email/attachments";
import { emailConfigured } from "@/lib/email/client";
import {
  type Conversation,
  countThreads,
  countWorkspaces,
  getConversation,
  isThreadFilter,
  listSendableAddresses,
  listThreads,
  type ThreadFilter,
  type ThreadMessage,
} from "@/lib/inbox/queries";
import { inboxHref } from "@/lib/inbox/url";
import { initial } from "@/shared/format";
import { ComposeBox } from "./compose-box";
import { MessageBody } from "./message-body";
import { ReplyBox } from "./reply-box";
import { ThreadActions } from "./thread-actions";
import { ThreadList } from "./thread-list";
import { ThreadOpener } from "./thread-opener";
import { WorkspaceTabs } from "./workspace-tabs";

type Props = { searchParams: Promise<{ t?: string; f?: string; q?: string; w?: string }> };

export async function InboxPage({ searchParams }: Props) {
  const [{ access }, { t, f, q, w }] = await Promise.all([
    requirePermission("mail.read"),
    searchParams,
  ]);

  const allowed = readableWorkspaces(access);
  const filter = isThreadFilter(f) ? f : "inbox";
  const query = q?.trim() ?? "";
  // A workspace in the URL that this operator cannot read is not an error, it
  // is simply not one of theirs — the tabs show what they have, and an
  // unreadable one falls back to all of them rather than to an empty page.
  const workspace = isMailWorkspace(w) && allowed.includes(w) ? w : undefined;

  const scope = { allowed, workspace };

  // All four at once when a conversation was named in the URL, which is every
  // navigation from the list.
  const [threads, counts, workspaceCounts, conversation, sendable] = await Promise.all([
    listThreads({ ...scope, filter, query }),
    countThreads(scope),
    countWorkspaces(scope),
    t ? getConversation(t, scope) : Promise.resolve(null),
    // Not narrowed by the open tab: composing from the ByteVeda tab to an
    // academy address is a decision the operator is allowed to make, and the
    // action checks the same list again.
    can(access, "mail.send") ? listSendableAddresses({ allowed }) : Promise.resolve([]),
  ]);

  // Staged for the conversation that is actually open, and only then: this is a
  // second round trip, and the list does not need it.
  const staged = conversation
    ? await listStaged({ kind: "reply", id: conversation.thread.threadKey })
    : [];

  return (
    <>
      {/* Mail arrives at a webhook, so nothing on this page would otherwise
          notice. The stream that badges the rail also ticks this. */}
      <InboxAutoRefresh />

      <PageHeader title="Inbox" sub={summary(counts.unread, query, threads.length)}>
        {/* Only when there is a choice to make. One workspace is not a set of
            tabs, it is a heading nobody asked for. */}
        {allowed.length > 1 && (
          <WorkspaceTabs
            allowed={allowed}
            selected={workspace}
            counts={workspaceCounts}
            filter={filter}
            query={query}
          />
        )}

        <ComposeBox
          addresses={sendable}
          canSend={emailConfigured()}
          maxFileBytes={maxFileBytes()}
        />
      </PageHeader>

      {allowed.length === 0 ? (
        <div className="content">
          <div className="empty">
            <h3>No mailboxes</h3>
            <p>Your account has no mail access yet. A super admin can grant it under Members.</p>
          </div>
        </div>
      ) : counts.inbox === 0 && counts.archived === 0 && !query ? (
        <div className="content">
          <div className="empty">
            <h3>No mail yet</h3>
            <p>
              Point a Resend inbound route at <code>/api/webhooks/resend</code> and replies land
              here.
            </p>
          </div>
        </div>
      ) : (
        // Which half a narrow screen shows. Two panes side by side is a desk
        // layout; on a phone it was a 40dvh list with a conversation under it,
        // and neither half was usable.
        <div className="inbox" data-pane={conversation ? "thread" : "list"}>
          <ThreadList
            threads={threads}
            counts={counts}
            filter={filter}
            query={query}
            workspace={workspace}
            showWorkspace={allowed.length > 1 && !workspace}
            selected={conversation?.thread.threadKey}
          />

          <div className="thread-view">
            {conversation ? (
              <ConversationPane
                conversation={conversation}
                filter={filter}
                query={query}
                workspace={workspace}
                staged={staged}
                canSend={emailConfigured() && can(access, "mail.send")}
                canManage={can(access, "mail.manage")}
                maxFileBytes={maxFileBytes()}
              />
            ) : (
              <div className="empty">
                <h3>Nothing selected</h3>
                <p>Pick a conversation on the left, or press j.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

/** The line under the title: what is unread, or what a search turned up. */
function summary(unread: number, query: string, results: number): string | undefined {
  if (query) return `${results} result${results === 1 ? "" : "s"} for “${query}”`;
  return unread > 0 ? `${unread} unread` : undefined;
}

function ConversationPane({
  conversation,
  filter,
  query,
  workspace,
  staged,
  canSend,
  canManage,
  maxFileBytes: perFile,
}: {
  conversation: Conversation;
  filter: ThreadFilter;
  query: string;
  workspace: MailWorkspace | undefined;
  staged: { id: string; filename: string; contentType: string; byteSize: number }[];
  canSend: boolean;
  canManage: boolean;
  maxFileBytes: number;
}) {
  const { thread, messages } = conversation;

  // Only what arrived can be repaired: a sent message with no body is one from
  // before replies were kept, and Resend has nothing to return for it.
  const repairable = messages.some((message) => message.direction === "in" && bodyMissing(message));

  return (
    <>
      <header className="thread-head">
        <Link className="thread-back" href={inboxHref({ filter, query, workspace })}>
          <ArrowLeft aria-hidden />
          All conversations
        </Link>

        <h2>{thread.subject || "(no subject)"}</h2>

        <p className="thread-route">
          <b>{thread.correspondentEmail}</b>
          <MoveRight aria-hidden />
          <b>{thread.mailbox}</b>
          <span className="sr-only">
            {messages.length} message{messages.length === 1 ? "" : "s"}
          </span>
        </p>

        {canManage && (
          <ThreadActions
            threadKey={thread.threadKey}
            archived={thread.archivedAt !== null}
            correspondent={thread.correspondentEmail}
            filter={filter}
            query={query}
            workspace={workspace}
          />
        )}
      </header>

      {/* Marks the conversation read and repairs any missing body. Below the
          header because it can turn into a notice, and a notice about this
          conversation belongs inside it. */}
      <ThreadOpener threadKey={thread.threadKey} pending={isUnread(thread) || repairable} />

      {messages.map((message) => (
        <Message key={message.id} message={message} />
      ))}

      {canSend ? (
        <ReplyBox
          threadKey={thread.threadKey}
          to={thread.correspondentEmail}
          from={thread.mailbox}
          canSend={canSend}
          attachments={staged}
          maxFileBytes={perFile}
        />
      ) : (
        <p className="notice notice-warn block-gap">
          <span>Your role can read this conversation but not answer it.</span>
        </p>
      )}
    </>
  );
}

function isUnread(thread: Conversation["thread"]): boolean {
  if (!thread.lastInboundAt) return false;
  return thread.readAt === null || thread.lastInboundAt > thread.readAt;
}

/**
 * One message, in the direction it went.
 *
 * Ours are marked and set apart rather than rendered identically to theirs: a
 * conversation where both sides look the same is one you have to read to know
 * who said what.
 */
function Message({ message }: { message: ThreadMessage }) {
  const sent = message.direction === "out";

  return (
    <article className="message" data-direction={message.direction}>
      <div className="message-meta">
        <span className="message-avatar" aria-hidden>
          {sent ? "↩" : initial(message.fromName, message.fromEmail)}
        </span>

        <span className="message-who">
          <b>{sent ? "You" : (message.fromName ?? message.fromEmail)}</b>
          <span>{message.fromEmail || message.toEmail}</span>
        </span>

        <LocalTime value={message.at.toISOString()} />
      </div>

      {message.error && (
        <p className="notice notice-danger block-gap-sm" role="status">
          <TriangleAlert aria-hidden />
          <span>This reply did not send. {message.error}</span>
        </p>
      )}

      {sent && !message.text.trim() && message.attachments.length === 0 ? (
        <p className="message-empty">
          Sent, but the text was not kept — this reply predates the console storing them.
        </p>
      ) : (
        <MessageBody text={message.text} html={message.html} />
      )}

      {message.attachments.length > 0 && (
        <ul className="attachment-list message-attachments">
          {message.attachments.map((file) => (
            <li key={file.id} className="attachment">
              <Paperclip aria-hidden />
              {/* A plain link, not a fetch: the browser's own download is what
                  an operator expects of a file, and the route is behind the
                  same session cookie as this page. */}
              <a href={`/api/attachments/${file.id}`} download={file.filename}>
                {file.filename}
              </a>
              <span className="attachment-size">{formatBytes(file.byteSize)}</span>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}
