"use server";

import { broadcasts, getDb } from "@byteveda/db";
import { desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { refuse } from "@/features/auth";
import * as attachments from "@/lib/attachments/store";
import { emailConfigured } from "@/lib/email/client";
import { getSettings } from "@/lib/settings";
import { sendBroadcastNow } from "./service";

export type BroadcastResult = { ok: boolean; message: string };

export async function listBroadcasts(limit = 25) {
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
