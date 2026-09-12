"use server";

import { getDb, inboundMessages } from "@byteveda/db";
import { and, desc, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth/session";
import { emailConfigured, fetchInboundBody, sendEmail } from "@/lib/email/client";
import { bodyMissing } from "@/lib/email/inbound";
import { replyEmail } from "@/lib/email/templates";
import { getThread } from "@/lib/inbox/queries";
import { inboxChanged } from "@/lib/realtime";

export type InboxResult = { ok: boolean; message: string };

/**
 * What opening a conversation did.
 *
 * `error` is set when a message in the thread has no body and Resend would not
 * hand one over. The browser is the only place that report is any use — the
 * operator is looking at the empty conversation it explains.
 */
export type ThreadOpened = { repaired: number; error: string | null };

/**
 * Everything opening a conversation implies: its messages are readable, and it
 * is no longer unread.
 *
 * Called from the browser rather than while rendering. Two reasons, both of
 * which were bugs: `revalidatePath` throws if it runs during a render, and a
 * `<Link>` prefetch renders the target page — so marking read server-side meant
 * hovering a thread in the list marked it read without anyone opening it.
 */
export async function openThread(threadKey: string): Promise<ThreadOpened> {
  await requireSession();

  const backfill = await backfillBodies(threadKey);

  const read = await getDb()
    .update(inboundMessages)
    .set({ readAt: new Date() })
    .where(and(eq(inboundMessages.threadKey, threadKey), isNull(inboundMessages.readAt)))
    .returning({ id: inboundMessages.id });

  // Nothing changed on a second visit to an already-read thread. Announcing
  // anyway would refresh every open console for no reason, and refresh this one
  // into calling back here.
  if (read.length > 0 || backfill.repaired > 0) {
    revalidatePath("/inbox");
    inboxChanged.publish();
  }

  return backfill;
}

/**
 * Fetches the bodies of any messages in a thread that were stored without one.
 *
 * Repairs the mail that arrived while the webhook believed the payload carried
 * the message. Nothing schedules this — a conversation is repaired when someone
 * opens it, which is the only time it matters.
 *
 * One reason is reported, not one per message: a thread whose bodies are
 * missing is missing them all for the same reason, and that reason is almost
 * always the API key.
 */
async function backfillBodies(threadKey: string): Promise<ThreadOpened> {
  if (!emailConfigured()) {
    return { repaired: 0, error: null };
  }

  const missing = (await getThread(threadKey)).filter(bodyMissing);
  if (missing.length === 0) return { repaired: 0, error: null };

  const fetched = await Promise.all(
    missing.map(async (message) => ({
      id: message.id,
      result: await fetchInboundBody(message.resendId),
    })),
  );

  const db = getDb();
  let repaired = 0;
  let error: string | null = null;

  for (const { id, result } of fetched) {
    if (!result.ok) {
      error ??= result.reason;
      continue;
    }

    const { text, html, headers } = result.body;
    // Resend answered, and the message really is empty. Nothing to write, and
    // nothing to complain about either.
    if (!text?.trim() && !html?.trim()) continue;

    await db
      .update(inboundMessages)
      .set({ text: text ?? "", html: html ?? null, headers: headers ?? null })
      .where(eq(inboundMessages.id, id));

    repaired += 1;
  }

  return { repaired, error };
}

export async function deleteThread(threadKey: string): Promise<InboxResult> {
  await requireSession();

  await getDb().delete(inboundMessages).where(eq(inboundMessages.threadKey, threadKey));
  revalidatePath("/inbox");
  inboxChanged.publish();

  return { ok: true, message: "Deleted." };
}

/**
 * Replies to the most recent message in a thread.
 *
 * The reply is quoted the way a mail client would quote it, so the recipient
 * sees the conversation rather than a bare sentence with no context.
 */
export async function replyToThread(threadKey: string, body: string): Promise<InboxResult> {
  await requireSession();

  const text = body.trim();
  if (!text) return { ok: false, message: "Write something first." };
  if (!emailConfigured()) {
    return { ok: false, message: "Set RESEND_API_KEY before sending." };
  }

  const db = getDb();
  const [latest] = await db
    .select()
    .from(inboundMessages)
    .where(eq(inboundMessages.threadKey, threadKey))
    .orderBy(desc(inboundMessages.receivedAt))
    .limit(1);

  if (!latest) return { ok: false, message: "That conversation no longer exists." };

  // Answer from the address they wrote to. A reply to conduct@ that arrives
  // from hello@ reads as a different correspondent, breaks threading in the
  // recipient's client, and sends their next message to the wrong mailbox.
  const from = latest.toEmail || undefined;

  const result = await sendEmail({
    to: latest.fromEmail,
    email: replyEmail({ subject: latest.subject, body: text, quoted: latest.text }),
    kind: "reply",
    from,
    replyTo: from,
  });

  if (!result.ok) return { ok: false, message: result.error ?? "The reply did not send." };

  await db
    .update(inboundMessages)
    .set({ repliedAt: new Date(), readAt: latest.readAt ?? new Date() })
    .where(eq(inboundMessages.id, latest.id));

  revalidatePath("/inbox");
  inboxChanged.publish();

  return { ok: true, message: `Replied to ${latest.fromEmail}.` };
}
