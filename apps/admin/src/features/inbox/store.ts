import { emailThreads, getDb, inboundMessages } from "@byteveda/db";
import type { MailWorkspace } from "@byteveda/db/constants";
import { and, eq } from "drizzle-orm";
import { type InboundRow, replyTargetOf, workspaceOf } from "@/features/mail";
import { previewOf } from "./model";
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
  // Which business the conversation belongs to, decided from the address it
  // arrived at and the one it came from — the academy writes to itself every
  // time somebody asks for a sample. See `features/mail/model.ts`.
  const workspace = workspaceOf(row.toEmail, row.fromEmail);

  // Who a reply goes to, which is not always who sent it. `inbound_messages`
  // keeps the real `From` either way — that row is the record of what arrived,
  // and only the conversation's correspondent is the reply target. The thread
  // key stays keyed on the sender so that changing this cannot re-group mail
  // that is already filed.
  const correspondent = replyTargetOf(row.fromEmail, row.headers);

  return getDb().transaction(async (tx) => {
    await tx
      .insert(emailThreads)
      .values({
        threadKey: row.threadKey,
        subject: row.subject,
        correspondentEmail: correspondent.email,
        correspondentName: correspondent.name ?? row.fromName,
        mailbox: row.toEmail,
        workspace,
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
        //
        // The name comes from the same place the address did. Taking the
        // sender's display name while the address stays the reply target is
        // how a thread ends up labelled "ByteVeda Academy" over a student's
        // address.
        ...((correspondent.name ?? row.fromName)
          ? { correspondentName: correspondent.name ?? row.fromName }
          : {}),
        // Both, together: the workspace is derived from the mailbox, and a
        // thread whose last message came to another address belongs with that
        // address. Updating one without the other is how they disagree.
        mailbox: row.toEmail,
        workspace,
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
 * Opens a conversation for a message the console is starting.
 *
 * Called before the send rather than after it, because `outbound_messages`
 * points at a thread by foreign key and a send filed against a key that does
 * not exist yet would be refused by Postgres. A thread whose send then fails is
 * the right outcome anyway: the attempt and its error belong in the console,
 * which is the whole reason the outbound row is written either way.
 *
 * The key is the one an inbound reply will compute — sender plus subject, see
 * `threadKeyFor` — so when they write back their message lands in this
 * conversation instead of starting a second one beside it.
 *
 * Read at the moment it is created. Nobody needs telling about a message they
 * just wrote themselves.
 */
export async function openOutboundThread(input: {
  threadKey: string;
  subject: string;
  to: string;
  from: string;
  workspace: MailWorkspace;
  body: string;
  at?: Date;
}): Promise<void> {
  const at = input.at ?? new Date();

  await getDb()
    .insert(emailThreads)
    .values({
      threadKey: input.threadKey,
      subject: input.subject,
      correspondentEmail: input.to,
      correspondentName: null,
      mailbox: input.from,
      workspace: input.workspace,
      preview: previewOf(input.body),
      lastMessageAt: at,
      lastOutboundAt: at,
      readAt: at,
      createdAt: at,
    })
    // Writing again to somebody about the same thing continues the
    // conversation. `markThreadAnswered` moves it on once the send lands.
    .onConflictDoNothing();
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

/**
 * Writes a body that was fetched from Resend after the fact.
 *
 * The headers arrive with it, and they are where `Reply-To` lives — so a
 * message repaired here had its conversation's correspondent worked out
 * without them. Repairing the body re-derives that too, which is what heals a
 * thread filed before any of this existed: the academy's work orders were all
 * pointing a reply back at the academy, and the address of the person actually
 * waiting was sitting unread in these headers the whole time.
 *
 * Only ever narrows towards the truth. `replyTargetOf` falls back to the
 * sender, so a message with no `Reply-To` rewrites the correspondent to what
 * it already was.
 */
export async function repairBody(
  id: string,
  body: { text: string | null; html: string | null; headers: Record<string, string> | null },
): Promise<void> {
  await getDb().transaction(async (tx) => {
    const [message] = await tx
      .update(inboundMessages)
      .set({ text: body.text ?? "", html: body.html ?? null, headers: body.headers ?? null })
      .where(eq(inboundMessages.id, id))
      .returning({
        threadKey: inboundMessages.threadKey,
        fromEmail: inboundMessages.fromEmail,
        fromName: inboundMessages.fromName,
      });

    if (!message?.threadKey || !body.headers) return;

    const correspondent = replyTargetOf(message.fromEmail, body.headers);

    await tx
      .update(emailThreads)
      .set({
        correspondentEmail: correspondent.email,
        correspondentName: correspondent.name ?? message.fromName,
      })
      .where(eq(emailThreads.threadKey, message.threadKey));
  });
}
