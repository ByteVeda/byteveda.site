"use server";

import { getDb, inboundMessages } from "@byteveda/db";
import { and, desc, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth/session";
import { emailConfigured, sendEmail } from "@/lib/email/client";
import { replyEmail } from "@/lib/email/templates";

export type InboxResult = { ok: boolean; message: string };

export async function markThreadRead(threadKey: string): Promise<void> {
  await requireSession();

  await getDb()
    .update(inboundMessages)
    .set({ readAt: new Date() })
    .where(and(eq(inboundMessages.threadKey, threadKey), isNull(inboundMessages.readAt)));

  revalidatePath("/inbox");
}

export async function deleteThread(threadKey: string): Promise<InboxResult> {
  await requireSession();

  await getDb().delete(inboundMessages).where(eq(inboundMessages.threadKey, threadKey));
  revalidatePath("/inbox");

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

  const result = await sendEmail({
    to: latest.fromEmail,
    email: replyEmail({ subject: latest.subject, body: text, quoted: latest.text }),
    kind: "reply",
  });

  if (!result.ok) return { ok: false, message: result.error ?? "The reply did not send." };

  await db
    .update(inboundMessages)
    .set({ repliedAt: new Date(), readAt: latest.readAt ?? new Date() })
    .where(eq(inboundMessages.id, latest.id));

  revalidatePath("/inbox");
  return { ok: true, message: `Replied to ${latest.fromEmail}.` };
}
