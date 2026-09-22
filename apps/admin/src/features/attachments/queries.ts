import { emailAttachments, getDb, outboundMessages } from "@byteveda/db";
import { and, asc, eq, isNull } from "drizzle-orm";
import type { AccessSnapshot } from "@/features/auth";
import { missing, reachThread, requires, type Verdict } from "@/features/mail";
import {
  type AttachmentRecord,
  type AttachmentScope,
  type LoadedFile,
  parseScope,
  type StagedFile,
  scopeKey,
} from "./model";

/**
 * Who may attach a file, who may read one back, and what is currently attached.
 *
 * Attachments inherit their permissions from the message they belong to, so the
 * question is never "may this operator use attachments" but "may this operator
 * write in *this* composer" — and for a reply, that includes the workspace the
 * conversation is in. Somebody given the academy's mail must not be able to
 * reach a ByteVeda conversation's attachment by its id.
 *
 * Kept apart from the routes so the upload, the download and the server action
 * cannot answer it differently.
 */

/** Everything about a stored file except the bytes. Shared with `store.ts`. */
export const METADATA = {
  id: emailAttachments.id,
  filename: emailAttachments.filename,
  contentType: emailAttachments.contentType,
  byteSize: emailAttachments.byteSize,
  createdAt: emailAttachments.createdAt,
};

/**
 * Whether this operator may put a file in this composer.
 *
 * A reply is checked against the conversation rather than against the inbox as
 * a whole: `mail.send` says they answer mail, and the workspace says whose.
 */
export async function authoriseScope(
  scope: AttachmentScope,
  access: AccessSnapshot,
): Promise<Verdict> {
  if (scope.kind === "broadcast") return requires(access, "broadcasts.send");
  // A composed message has no conversation to check against — the draft id is
  // a handle on a form, not on anything stored. `mail.send` is the same gate
  // the send itself passes, and the send is where the chosen from-address is
  // checked against the workspaces this operator may write as.
  if (scope.kind === "compose") return requires(access, "mail.send");
  return reachThread(scope.id, access, "mail.send");
}

/**
 * Whether this operator may download a stored attachment.
 *
 * Three cases, and they are genuinely different:
 *
 *  - still staged: it is sitting in a composer, so the composer decides.
 *  - sent in a reply: the conversation decides, including its workspace.
 *  - sent in a broadcast: there is no conversation, so the mailing list does.
 */
export async function authoriseDownload(
  file: { scope: string; messageId: string | null },
  access: AccessSnapshot,
): Promise<Verdict> {
  if (!file.messageId) {
    const separator = file.scope.indexOf(":");
    const scope = parseScope(
      file.scope.slice(0, separator),
      // A thread key contains colons of its own, so only the first one splits.
      file.scope.slice(separator + 1),
    );

    if (!scope) return missing("That attachment no longer exists.");
    return authoriseScope(scope, access);
  }

  const [message] = await getDb()
    .select({ threadKey: outboundMessages.threadKey })
    .from(outboundMessages)
    .where(eq(outboundMessages.id, file.messageId))
    .limit(1);

  if (!message) return missing("That attachment no longer exists.");

  // No conversation means it went to the mailing list. Whoever may see the
  // list may see what was sent to it.
  if (!message.threadKey) return requires(access, "subscribers.read");

  return reachThread(message.threadKey, access, "mail.read");
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
