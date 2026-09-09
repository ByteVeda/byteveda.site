import type { Metadata } from "next";
import Link from "next/link";
import { ReplyBox } from "@/components/inbox/reply-box";
import { PageHeader } from "@/components/page-header";
import { emailConfigured } from "@/lib/email/client";
import { ago } from "@/lib/format";
import { markThreadRead } from "@/lib/inbox/actions";
import { getThread, listThreads } from "@/lib/inbox/queries";

export const metadata: Metadata = { title: "Inbox" };
export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ t?: string }> };

export default async function InboxPage({ searchParams }: Props) {
  const { t } = await searchParams;
  const threads = await listThreads();

  // Default to the newest conversation rather than an empty right-hand pane.
  const selectedKey = t ?? threads[0]?.threadKey;
  const messages = selectedKey ? await getThread(selectedKey) : [];
  const selected = threads.find((thread) => thread.threadKey === selectedKey);

  if (selected && selected.unreadCount > 0) await markThreadRead(selected.threadKey);

  const unread = threads.reduce((total, thread) => total + thread.unreadCount, 0);

  return (
    <>
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
                  <h2>{selected.subject || "(no subject)"}</h2>
                  <p>
                    {selected.fromEmail} → {messages[0]?.toEmail}
                    {selected.repliedAt ? " · replied" : ""}
                  </p>
                </header>

                {messages.map((message) => (
                  <article key={message.id} className="message">
                    <div className="message-meta">
                      <span>{message.fromName ?? message.fromEmail}</span>
                      <time dateTime={message.receivedAt.toISOString()}>
                        {message.receivedAt.toLocaleString(undefined, {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </time>
                    </div>
                    <div className="message-body">{message.text}</div>
                  </article>
                ))}

                <ReplyBox
                  threadKey={selected.threadKey}
                  to={selected.fromEmail}
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
