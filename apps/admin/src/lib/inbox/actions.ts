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
 * Everything opening a conversation implies: its messages are readable, and it
 * is no longer unread.
 *
 * Called from the browser rather than while rendering. Two reasons, both of
 * which were bugs: `revalidatePath` throws if it runs during a render, and a
 * `<Link>` prefetch renders the target page — so marking read server-side meant
 * hovering a thread in the list marked it read without anyone opening it.
 */
export async function openThread(threadKey: string): Promise<void> {
  await requireSession();

  const repaired = await backfillBodies(threadKey);

  const read = await getDb()
    .update(inboundMessages)
    .set({ readAt: new Date() })
    .where(and(eq(inboundMessages.threadKey, threadKey), isNull(inboundMessages.readAt)))
    .returning({ id: inboundMessages.id });

  // Nothing changed on a second visit to an already-read thread. Announcing
  // anyway would refresh every open console for no reason, and refresh this one
  // into calling back here.
  if (read.length === 0 && repaired === 0) return;

  revalidatePath("/inbox");
  inboxChanged.publish();
}

/**
 * Fetches the bodies of any messages in a thread that were stored without one.
 *
 * Repairs the mail that arrived while the webhook believed the payload carried
 * the message. Nothing schedules this — a conversation is repaired when someone
 * opens it, which is the only time it matters.
 */
async function backfillBodies(threadKey: string): Promise<number> {
  if (!emailConfigured()) return 0;

  const missing = (await getThread(threadKey)).filter(bodyMissing);
  if (missing.length === 0) return 0;

  const fetched = await Promise.all(
    missing.map(async (message) => ({
      id: message.id,
      body: await fetchInboundBody(message.resendId),
    })),
  );

  const db = getDb();
  let repaired = 0;

  for (const { id, body } of fetched) {
    if (!body || (!body.text?.trim() && !body.html?.trim())) continue;

    await db
      .update(inboundMessages)
      .set({
        text: body.text ?? "",
        html: body.html ?? null,
        headers: body.headers ?? null,
      })
      .where(eq(inboundMessages.id, id));

    repaired += 1;
  }

  return repaired;
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
