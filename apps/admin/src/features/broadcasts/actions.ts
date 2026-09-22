"use server";

import { broadcasts, getDb } from "@byteveda/db";
import { desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import * as attachments from "@/features/attachments";
import { refuse } from "@/features/auth";
import { getSettings } from "@/features/settings";
import { emailConfigured } from "@/lib/email/client";
import { sendBroadcastNow } from "./service";

export type BroadcastResult = { ok: boolean; message: string };

/**
 * The drafts and the sends, for the composer.
 *
 * Guarded like every write in this file, and for the same reason: an exported
 * `"use server"` function is a URL anybody can post to, and the rows carry the
 * subject and body of everything the console has ever mailed the list. The
 * page already hides the composer from an operator without the grant — this is
 * what makes that more than a hidden button.
 */
export async function listBroadcasts(limit = 25) {
  const refused = await refuse("broadcasts.send");
  if (refused) return [];

  return getDb().select().from(broadcasts).orderBy(desc(broadcasts.createdAt)).limit(limit);
}

export async function saveBroadcast(input: {
  id?: string;
  subject: string;
  bodyMarkdown: string;
}): Promise<BroadcastResult & { id?: string }> {
  const refused = await refuse("broadcasts.send");
  if (refused) return refused;

  const subject = input.subject.trim();
  if (!subject) return { ok: false, message: "Give the broadcast a subject." };

  const db = getDb();

  if (input.id) {
    await db
      .update(broadcasts)
      .set({ subject, bodyMarkdown: input.bodyMarkdown, updatedAt: new Date() })
      .where(eq(broadcasts.id, input.id));

    revalidatePath("/subscribers");
    return { ok: true, message: "Saved.", id: input.id };
  }

  const [created] = await db
    .insert(broadcasts)
    .values({ subject, bodyMarkdown: input.bodyMarkdown })
    .returning({ id: broadcasts.id });

  revalidatePath("/subscribers");
  return { ok: true, message: "Saved.", id: created.id };
}

export async function sendBroadcast(id: string): Promise<BroadcastResult> {
  const refused = await refuse("broadcasts.send");
  if (refused) return refused;

  if (!emailConfigured()) return { ok: false, message: "Set RESEND_API_KEY before sending." };

  const settings = await getSettings();
  if (!settings["newsletter.enabled"]) {
    return { ok: false, message: "Turn the newsletter on in settings before sending." };
  }

  const result = await sendBroadcastNow(id);
  revalidatePath("/subscribers");
  return result;
}

export async function deleteBroadcast(id: string): Promise<BroadcastResult> {
  const refused = await refuse("broadcasts.send");
  if (refused) return refused;

  const db = getDb();
  const [existing] = await db.select().from(broadcasts).where(eq(broadcasts.id, id)).limit(1);

  if (existing?.status === "sent") {
    // The row is the record that it went out; deleting it would lose that.
    return { ok: false, message: "A sent broadcast cannot be deleted." };
  }

  // Anything staged against the draft goes with it. The foreign key only covers
  // files that were sent — a staged one belongs to a composer, and this is the
  // composer being thrown away.
  await attachments.discardAll({ kind: "broadcast", id });
  await db.delete(broadcasts).where(eq(broadcasts.id, id));
  revalidatePath("/subscribers");

  return { ok: true, message: "Deleted." };
}

/** What is attached to a draft, for the composer to show after a reload. */
export async function listBroadcastAttachments(id: string): Promise<attachments.StagedFile[]> {
  const refused = await refuse("broadcasts.send");
  if (refused) return [];

  return attachments.listStaged({ kind: "broadcast", id });
}
