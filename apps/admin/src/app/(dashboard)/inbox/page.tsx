import { CornerUpLeft, MoveRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { InboxAutoRefresh } from "@/components/inbox/live";
import { MessageBody } from "@/components/inbox/message-body";
import { ReplyBox } from "@/components/inbox/reply-box";
import { ThreadOpener } from "@/components/inbox/thread-opener";
import { LocalTime } from "@/components/local-time";
import { PageHeader } from "@/components/page-header";
import { emailConfigured } from "@/lib/email/client";
import { bodyMissing } from "@/lib/email/inbound";
import { ago, initial } from "@/lib/format";
import { getThread, listThreads } from "@/lib/inbox/queries";

export const metadata: Metadata = { title: "Inbox" };
export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ t?: string }> };

export default async function InboxPage({ searchParams }: Props) {
  const { t } = await searchParams;

  // Both reads at once when a conversation was named in the URL, which is every
  // navigation from the list. Only a bare `/inbox` has to see the threads first
  // to learn which one is newest.
  const [threads, requested] = await Promise.all([
    listThreads(),
    t ? getThread(t) : Promise.resolve(null),
  ]);

  // Default to the newest conversation rather than an empty right-hand pane.
  const selectedKey = t ?? threads[0]?.threadKey;
  const messages = requested ?? (selectedKey ? await getThread(selectedKey) : []);
  const selected = threads.find((thread) => thread.threadKey === selectedKey);

  const unread = threads.reduce((total, thread) => total + thread.unreadCount, 0);

  // The address they wrote to, which is also the one the reply leaves from.
  const mailbox = messages[messages.length - 1]?.toEmail ?? "";

  return (
    <>
      {/* Mail arrives at a webhook, so nothing on this page would otherwise
          notice. The stream that badges the rail also ticks this. */}
      <InboxAutoRefresh />

      <PageHeader title="Inbox" sub={unread > 0 ? `${unread} unread` : undefined} />

      {threads.length === 0 ? (
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
        <div className="inbox">
          <nav className="thread-list" aria-label="Conversations">
            {threads.map((thread) => (
              <Link
                key={thread.threadKey}
                href={`/inbox?t=${encodeURIComponent(thread.threadKey)}`}
                className="thread-item"
                data-unread={thread.unreadCount > 0}
                aria-current={thread.threadKey === selectedKey}
              >
                <span className="thread-from">
                  {thread.unreadCount > 0 && (
                    <>
                      {/* The dot is decoration; the word is what a screen reader gets. */}
                      <i className="thread-unread" aria-hidden />
                      <span className="sr-only">Unread.</span>
                    </>
                  )}
                  <b>{thread.fromName ?? thread.fromEmail}</b>
                  <time dateTime={thread.lastReceivedAt.toISOString()}>
                    {ago(thread.lastReceivedAt)}
                  </time>
                </span>
                <span className="thread-subject">{thread.subject || "(no subject)"}</span>
                <span className="thread-preview">{thread.preview}</span>
              </Link>
            ))}
          </nav>

          <div className="thread-view">
            {selected ? (
              <>
                <header className="thread-head">
                  <h2>
                    {selected.subject || "(no subject)"}
                    {selected.repliedAt ? (
                      <span className="thread-flag">
                        <CornerUpLeft aria-hidden />
                        Replied
                      </span>
                    ) : null}
                  </h2>
                  <p className="thread-route">
                    <b>{selected.fromEmail}</b>
                    <MoveRight aria-hidden />
                    <b>{mailbox}</b>
                    <span className="sr-only">
                      {messages.length} message{messages.length === 1 ? "" : "s"}
                    </span>
                  </p>
                </header>

                {/* Marks the conversation read and repairs any missing body.
                    Below the header because it can turn into a notice, and a
                    notice about this conversation belongs inside it. */}
                <ThreadOpener
                  threadKey={selected.threadKey}
                  pending={selected.unreadCount > 0 || messages.some(bodyMissing)}
                />

                {messages.map((message) => (
                  <article key={message.id} className="message">
                    <div className="message-meta">
                      <span className="message-avatar" aria-hidden>
                        {initial(message.fromName, message.fromEmail)}
                      </span>
                      <span className="message-who">
                        <b>{message.fromName ?? message.fromEmail}</b>
                        <span>{message.fromEmail}</span>
                      </span>
                      <LocalTime value={message.receivedAt.toISOString()} />
                    </div>
                    <MessageBody text={message.text} html={message.html} />
                  </article>
                ))}

                <ReplyBox
                  threadKey={selected.threadKey}
                  to={selected.fromEmail}
                  from={mailbox}
                  canSend={emailConfigured()}
                />
              </>
            ) : (
              <div className="empty">
                <h3>Nothing selected</h3>
                <p>Pick a conversation on the left.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
