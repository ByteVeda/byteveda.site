import { emailThreads, getDb, inboundMessages } from "@byteveda/db";
import { and, eq } from "drizzle-orm";
import type { InboundRow } from "@/lib/email/inbound";
import { previewOf } from "./preview";
import { UNREAD } from "./queries";

/**
 * Writing to the inbox.
 *
 * Separate from `actions.ts` because the webhook is not a browser: a module
 * marked `"use server"` publishes every export as a server action, and a route
 * handler has no business reaching one.
 *
 * Everything a message changes about its conversation happens here, so that
 * `email_threads` cannot drift from the rows underneath it — which is the price
 * of denormalising the preview and the timestamps onto it.
 */

/**
 * Stores an arriving message and brings its conversation up to date.
 *
 * Returns false for a redelivery. A webhook is delivered at least once, and the
 * unique `resend_id` is what makes the second delivery a no-op — but only if
 * the thread is left alone too. Announcing a redelivery would re-sort the
 * inbox, re-mark it unread, and pull it back out of the archive, all for a
 * message the operator read yesterday.
 *
 * In a transaction because a thread has to exist before a message can point at
 * it, and a thread with no messages is a row nothing will ever show or delete.
 */
export async function recordInbound(row: InboundRow, receivedAt = new Date()): Promise<boolean> {
  const preview = previewOf(row.text, row.html);

  return getDb().transaction(async (tx) => {
    await tx
      .insert(emailThreads)
      .values({
        threadKey: row.threadKey,
        subject: row.subject,
        correspondentEmail: row.fromEmail,
        correspondentName: row.fromName,
        mailbox: row.toEmail,
        preview,
        lastMessageAt: receivedAt,
        lastInboundAt: receivedAt,
        createdAt: receivedAt,
      })
      .onConflictDoNothing();

    const [stored] = await tx
      .insert(inboundMessages)
      .values({ ...row, receivedAt })
      .onConflictDoNothing({ target: inboundMessages.resendId })
      .returning({ id: inboundMessages.id });

    if (!stored) return false;

    await tx
      .update(emailThreads)
      .set({
        // The subject is the conversation's, set when it opened. Later messages
        // are "Re: " that, and taking theirs would retitle the thread.
        ...(row.fromName ? { correspondentName: row.fromName } : {}),
        mailbox: row.toEmail,
        preview,
        lastMessageAt: receivedAt,
        lastInboundAt: receivedAt,
        // Mail arriving is exactly the event that makes an archived
        // conversation current again.
        archivedAt: null,
      })
      .where(eq(emailThreads.threadKey, row.threadKey));

    return true;
  });
}

/**
 * Moves a conversation on for a reply that went out.
 *
 * Only called for a send that succeeded. A failed one still belongs *in* the
 * conversation — the row carries its error and the thread shows it — but it
 * must not make the inbox claim the conversation was answered.
 *
 * Marks the thread read on the way past: answering something is a stronger
 * statement than opening it.
 */
export async function markThreadAnswered(
  threadKey: string,
  body: string,
  sentAt = new Date(),
): Promise<void> {
  await getDb()
    .update(emailThreads)
    .set({
      preview: previewOf(body),
      lastMessageAt: sentAt,
      lastOutboundAt: sentAt,
      readAt: sentAt,
    })
    .where(eq(emailThreads.threadKey, threadKey));
}

/**
 * Marks a conversation read, and says whether that changed anything.
 *
 * The answer matters. Opening a conversation that was already read must not
 * announce: every open console would re-render for nothing, and this one would
 * re-render straight back into calling this again.
 */
export async function markThreadRead(threadKey: string, at = new Date()): Promise<boolean> {
  const changed = await getDb()
    .update(emailThreads)
    .set({ readAt: at })
    .where(and(eq(emailThreads.threadKey, threadKey), UNREAD))
    .returning({ threadKey: emailThreads.threadKey });

  return changed.length > 0;
}

/**
 * Puts a conversation back to unread.
 *
 * `read_at` goes to null rather than backwards: unread is `last_inbound_at`
 * being newer than `read_at`, and any timestamp old enough to satisfy that
 * would be a lie about when this was last opened.
 */
export async function markThreadUnread(threadKey: string): Promise<void> {
  await getDb()
    .update(emailThreads)
    .set({ readAt: null })
    .where(eq(emailThreads.threadKey, threadKey));
}

/** Files a conversation away, or brings it back. */
export async function setThreadArchived(threadKey: string, archived: boolean): Promise<void> {
  await getDb()
    .update(emailThreads)
    .set({ archivedAt: archived ? new Date() : null })
    .where(eq(emailThreads.threadKey, threadKey));
}

/**
 * Removes a conversation and everything received in it.
 *
 * The sent messages survive as rows in `outbound_messages` with their thread
 * key set to null — the conversation goes, the record that something was sent
 * to that address stays. See the foreign keys in the schema.
 */
export async function deleteThread(threadKey: string): Promise<void> {
  await getDb().delete(emailThreads).where(eq(emailThreads.threadKey, threadKey));
}

/** Writes a body that was fetched from Resend after the fact. */
export async function repairBody(
  id: string,
  body: { text: string | null; html: string | null; headers: Record<string, string> | null },
): Promise<void> {
  await getDb()
    .update(inboundMessages)
    .set({ text: body.text ?? "", html: body.html ?? null, headers: body.headers ?? null })
    .where(eq(inboundMessages.id, id));
}
