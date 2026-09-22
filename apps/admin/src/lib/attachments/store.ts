import { type EmailAttachment, emailAttachments, getDb } from "@byteveda/db";
import { and, asc, eq, isNull, lt } from "drizzle-orm";
import { safeFilename } from "@/lib/email/attachments";

/**
 * Where a file waits between being chosen and being sent.
 *
 * Uploads are staged rather than posted with the message, and the reason is
 * arithmetic: Resend allows 40MB per email, a serverless request body allows
 * 4.5MB, and the only way to have both is one file per request with the message
 * assembled afterwards. `scope` is the composer it is waiting in.
 *
 * A staged row with no `message_id` is a file in a composer. Once the message
 * goes out the row is claimed by it, which is also what stops the sweep below
 * from taking it.
 */

export type AttachmentScope =
  /** A reply in the inbox, keyed by the conversation it belongs to. */
  | { kind: "reply"; id: string }
  /**
   * A message being written to somebody who has not written in.
   *
   * Keyed by a draft id rather than by a conversation, because there is no
   * conversation yet — the thread is opened by the send. A sheet going out to
   * a customer is the case this exists for, and the file has to be uploaded
   * before the address it is going to is even final.
   */
  | { kind: "compose"; id: string }
  /** A broadcast, keyed by its draft. */
  | { kind: "broadcast"; id: string };

export function scopeKey(scope: AttachmentScope): string {
  return `${scope.kind}:${scope.id}`;
}

/** What the composer shows: everything but the bytes. */
export type StagedFile = Pick<
  EmailAttachment,
  "id" | "filename" | "contentType" | "byteSize" | "createdAt"
>;

/** What a send needs. Reading `content` is what makes this the expensive one. */
export type LoadedFile = StagedFile & { content: Buffer };

/** Enough to decide whether somebody may have the file, without reading it. */
export type AttachmentRecord = StagedFile & { scope: string; messageId: string | null };

const METADATA = {
  id: emailAttachments.id,
  filename: emailAttachments.filename,
  contentType: emailAttachments.contentType,
  byteSize: emailAttachments.byteSize,
  createdAt: emailAttachments.createdAt,
};

/**
 * How long an unsent upload survives.
 *
 * A composer is abandoned all the time — a reply half written, a broadcast
 * thought better of — and each one leaves 4MB in Postgres that nothing will
 * ever reference. A week is long enough that coming back to a draft tomorrow
 * still finds its files.
 */
const STALE_AFTER_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Stores an uploaded file against a composer.
 *
 * The filename is sanitised here as well as at the boundary: this is the value
 * that ends up in a `Content-Disposition` header on the way back out, and a
 * name is only ever as safe as the last thing that touched it.
 */
export async function stage(input: {
  scope: AttachmentScope;
  filename: string;
  contentType: string;
  content: Buffer;
  uploadedBy: string;
}): Promise<StagedFile> {
  const [row] = await getDb()
    .insert(emailAttachments)
    .values({
      scope: scopeKey(input.scope),
      filename: safeFilename(input.filename),
      contentType: input.contentType || "application/octet-stream",
      byteSize: input.content.byteLength,
      content: input.content,
      uploadedBy: input.uploadedBy,
    })
    .returning(METADATA);

  return row;
}

/** What is currently attached to a composer, oldest first — the order they were picked. */
export async function listStaged(scope: AttachmentScope): Promise<StagedFile[]> {
  return getDb()
    .select(METADATA)
    .from(emailAttachments)
    .where(and(eq(emailAttachments.scope, scopeKey(scope)), isNull(emailAttachments.messageId)))
    .orderBy(asc(emailAttachments.createdAt));
}

/** The same files, with their bytes, for a send that is about to happen. */
export async function loadForSend(scope: AttachmentScope): Promise<LoadedFile[]> {
  return getDb()
    .select({ ...METADATA, content: emailAttachments.content })
    .from(emailAttachments)
    .where(and(eq(emailAttachments.scope, scopeKey(scope)), isNull(emailAttachments.messageId)))
    .orderBy(asc(emailAttachments.createdAt));
}

/**
 * Files one attachment out of storage for download, by id.
 *
 * Deliberately not scoped: the caller has already decided whether this operator
 * may see the conversation it belongs to, and a download route that re-derived
 * that from the file would be making an authorisation decision in the wrong
 * place. See `app/api/attachments/[id]/route.ts`.
 */
export async function load(id: string): Promise<LoadedFile | null> {
  const [row] = await getDb()
    .select({ ...METADATA, content: emailAttachments.content })
    .from(emailAttachments)
    .where(eq(emailAttachments.id, id))
    .limit(1);

  return row ?? null;
}

/**
 * Everything about an attachment except the bytes.
 *
 * Read before `load`, and the reason is the size of the column: deciding
 * whether somebody may download a 4MB file should not cost 4MB of transfer when
 * the answer is no.
 */
export async function describe(id: string): Promise<AttachmentRecord | null> {
  const [row] = await getDb()
    .select({ ...METADATA, scope: emailAttachments.scope, messageId: emailAttachments.messageId })
    .from(emailAttachments)
    .where(eq(emailAttachments.id, id))
    .limit(1);

  return row ?? null;
}

/**
 * Hands every staged file in a composer to the message that carried them.
 *
 * A broadcast is one message per recipient, and the files are claimed by the
 * first of them: the alternative is a copy of a 4MB attachment for every
 * address on the list, which is a way to fill a database rather than a way to
 * keep a record. The broadcast row is the record that it went out; this is the
 * record of *what* went.
 */
export async function claim(scope: AttachmentScope, messageId: string): Promise<number> {
  const claimed = await getDb()
    .update(emailAttachments)
    .set({ messageId })
    .where(and(eq(emailAttachments.scope, scopeKey(scope)), isNull(emailAttachments.messageId)))
    .returning({ id: emailAttachments.id });

  return claimed.length;
}

/**
 * Removes a file from a composer before it is sent.
 *
 * Scoped to the composer as well as the id, so a stray id cannot delete
 * somebody else's staged upload — and `message_id is null` so that "remove
 * this attachment" can never reach one that has already gone out, where the
 * row is history rather than a pending file.
 */
export async function discard(scope: AttachmentScope, id: string): Promise<boolean> {
  const removed = await getDb()
    .delete(emailAttachments)
    .where(
      and(
        eq(emailAttachments.id, id),
        eq(emailAttachments.scope, scopeKey(scope)),
        isNull(emailAttachments.messageId),
      ),
    )
    .returning({ id: emailAttachments.id });

  return removed.length > 0;
}

/** Everything staged in a composer, for a draft that is being deleted. */
export async function discardAll(scope: AttachmentScope): Promise<number> {
  const removed = await getDb()
    .delete(emailAttachments)
    .where(and(eq(emailAttachments.scope, scopeKey(scope)), isNull(emailAttachments.messageId)))
    .returning({ id: emailAttachments.id });

  return removed.length;
}

/**
 * Sweeps uploads nobody sent.
 *
 * Called on the way past when a new file is staged rather than from a cron:
 * the sweep is cheap, an abandoned upload is only ever created by the same act
 * that triggers it, and one fewer scheduled job is one fewer thing that can be
 * silently not running.
 */
export async function pruneStale(now = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - STALE_AFTER_MS);

  const removed = await getDb()
    .delete(emailAttachments)
    .where(and(isNull(emailAttachments.messageId), lt(emailAttachments.createdAt, cutoff)))
    .returning({ id: emailAttachments.id });

  return removed.length;
}
