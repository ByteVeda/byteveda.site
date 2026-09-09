import { broadcasts, getDb, type Post } from "@byteveda/db";
import { eq } from "drizzle-orm";
import { marked } from "marked";
import { sendMany } from "@/lib/email/client";
import { announcementEmail, broadcastEmail } from "@/lib/email/templates";
import { env } from "@/lib/env";
import { getSettings } from "@/lib/settings";
import { activeSubscribers } from "@/lib/subscribers/queries";
import { unsubscribeUrl } from "@/lib/subscribers/service";

const FLEXIQ_URL = "https://flexiq.byteveda.org";

function origin(): string {
  return env.adminUrl() ?? "https://admin.byteveda.org";
}

export type SendOutcome = { ok: boolean; message: string };

/**
 * Sends a broadcast to every confirmed subscriber.
 *
 * Each recipient gets their own unsubscribe link, which is why this cannot be
 * one batched send. The status moves to `sending` first so a second click, or
 * a retry after a timeout, does not send the whole list twice.
 */
export async function sendBroadcastNow(broadcastId: string): Promise<SendOutcome> {
  const db = getDb();
  const [broadcast] = await db
    .select()
    .from(broadcasts)
    .where(eq(broadcasts.id, broadcastId))
    .limit(1);

  if (!broadcast) return { ok: false, message: "That broadcast no longer exists." };
  if (broadcast.status === "sent") return { ok: false, message: "That one has already gone out." };
  if (broadcast.status === "sending") return { ok: false, message: "That one is already sending." };

  const recipients = await activeSubscribers();
  if (recipients.length === 0) {
    return { ok: false, message: "Nobody has confirmed a subscription yet." };
  }

  await db.update(broadcasts).set({ status: "sending" }).where(eq(broadcasts.id, broadcastId));

  const bodyHtml = marked.parse(broadcast.bodyMarkdown, { gfm: true, async: false });

  const { sent, failed, firstError } = await sendMany(
    recipients.map((subscriber) => ({
      to: subscriber.email,
      email: broadcastEmail({
        subject: broadcast.subject,
        bodyHtml,
        bodyText: broadcast.bodyMarkdown,
        unsubscribeUrl: unsubscribeUrl(origin(), subscriber.token),
      }),
    })),
    { kind: "broadcast", broadcastId },
  );

  await db
    .update(broadcasts)
    .set({
      // Partial delivery still counts as sent — the log records who missed out,
      // and resending to everyone would mail the successes twice.
      status: sent > 0 ? "sent" : "failed",
      recipientCount: sent,
      sentAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(broadcasts.id, broadcastId));

  if (failed > 0) {
    return {
      ok: sent > 0,
      message: `Sent to ${sent}, ${failed} failed. ${firstError ?? ""}`.trim(),
    };
  }
  return { ok: true, message: `Sent to ${sent} subscriber${sent === 1 ? "" : "s"}.` };
}

/**
 * Announces a freshly published post, when the setting allows it.
 *
 * Returns a note for the operator rather than throwing: publishing has already
 * happened, and a mail problem must not read as a failed publish.
 */
export async function announcePost(post: Post): Promise<string | null> {
  const settings = await getSettings();
  if (!settings["announce.enabled"]) return null;

  const db = getDb();

  // The unique index on post_id is the real guard; this only avoids the noise
  // of a failed insert on a re-publish.
  const [existing] = await db
    .select({ id: broadcasts.id })
    .from(broadcasts)
    .where(eq(broadcasts.postId, post.id))
    .limit(1);

  if (existing) return null;

  const recipients = await activeSubscribers();
  if (recipients.length === 0) return null;

  const [broadcast] = await db
    .insert(broadcasts)
    .values({
      subject: post.title,
      bodyMarkdown: post.description,
      postId: post.id,
      status: "sending",
    })
    .returning({ id: broadcasts.id });

  const url = `${FLEXIQ_URL}/blog/${post.slug}`;

  const { sent, failed } = await sendMany(
    recipients.map((subscriber) => ({
      to: subscriber.email,
      email: announcementEmail({
        title: post.title,
        description: post.description,
        url,
        unsubscribeUrl: unsubscribeUrl(origin(), subscriber.token),
      }),
    })),
    { kind: "announcement", broadcastId: broadcast.id },
  );

  await db
    .update(broadcasts)
    .set({
      status: sent > 0 ? "sent" : "failed",
      recipientCount: sent,
      sentAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(broadcasts.id, broadcast.id));

  return failed > 0
    ? `Announced to ${sent}, ${failed} failed.`
    : `Announced to ${sent} subscriber${sent === 1 ? "" : "s"}.`;
}
