import { ArrowLeft, MoveRight, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { InboxAutoRefresh, LocalTime, PageHeader } from "@/components";
import { emailConfigured } from "@/lib/email/client";
import { bodyMissing } from "@/lib/email/inbound";
import { initial } from "@/lib/format";
import {
  type Conversation,
  countThreads,
  getConversation,
  isThreadFilter,
  listThreads,
  type ThreadFilter,
  type ThreadMessage,
} from "@/lib/inbox/queries";
import { inboxHref } from "@/lib/inbox/url";
import { MessageBody } from "./message-body";
import { ReplyBox } from "./reply-box";
import { ThreadActions } from "./thread-actions";
import { ThreadList } from "./thread-list";
import { ThreadOpener } from "./thread-opener";

type Props = { searchParams: Promise<{ t?: string; f?: string; q?: string }> };

export async function InboxPage({ searchParams }: Props) {
  const { t, f, q } = await searchParams;

  const filter = isThreadFilter(f) ? f : "inbox";
  const query = q?.trim() ?? "";

  // All three at once when a conversation was named in the URL, which is every
  // navigation from the list. Only a bare `/inbox` has to see the threads first
  // to learn which one is newest.
  const [threads, counts, requested] = await Promise.all([
    listThreads({ filter, query }),
    countThreads(),
    t ? getConversation(t) : Promise.resolve(null),
  ]);

  // Default to the newest conversation rather than an empty right-hand pane.
  const selectedKey = requested?.thread.threadKey ?? (t ? undefined : threads[0]?.threadKey);
  const conversation = requested ?? (selectedKey ? await getConversation(selectedKey) : null);

  return (
    <>
      {/* Mail arrives at a webhook, so nothing on this page would otherwise
          notice. The stream that badges the rail also ticks this. */}
      <InboxAutoRefresh />

      <PageHeader title="Inbox" sub={summary(counts.unread, query, threads.length)} />

      {counts.inbox === 0 && counts.archived === 0 && !query ? (
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
            selected={conversation?.thread.threadKey}
          />

          <div className="thread-view">
            {conversation ? (
              <ConversationPane
                conversation={conversation}
                filter={filter}
                query={query}
                canSend={emailConfigured()}
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
  canSend,
}: {
  conversation: Conversation;
  filter: ThreadFilter;
  query: string;
  canSend: boolean;
}) {
  const { thread, messages } = conversation;

  // Only what arrived can be repaired: a sent message with no body is one from
  // before replies were kept, and Resend has nothing to return for it.
  const repairable = messages.some((message) => message.direction === "in" && bodyMissing(message));

  return (
    <>
      <header className="thread-head">
        <Link className="thread-back" href={inboxHref({ filter, query })}>
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

        <ThreadActions
          threadKey={thread.threadKey}
          archived={thread.archivedAt !== null}
          correspondent={thread.correspondentEmail}
          filter={filter}
          query={query}
        />
      </header>

      {/* Marks the conversation read and repairs any missing body. Below the
          header because it can turn into a notice, and a notice about this
          conversation belongs inside it. */}
      <ThreadOpener threadKey={thread.threadKey} pending={isUnread(thread) || repairable} />

      {messages.map((message) => (
        <Message key={message.id} message={message} />
      ))}

      <ReplyBox
        threadKey={thread.threadKey}
        to={thread.correspondentEmail}
        from={thread.mailbox}
        canSend={canSend}
      />
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

      {sent && !message.text.trim() ? (
        <p className="message-empty">
          Sent, but the text was not kept — this reply predates the console storing them.
        </p>
      ) : (
        <MessageBody text={message.text} html={message.html} />
      )}
    </article>
  );
}
