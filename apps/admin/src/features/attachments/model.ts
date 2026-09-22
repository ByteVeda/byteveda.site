/**
 * What may be attached to a message, how much of it, and which composer it is
 * waiting in.
 *
 * Pure rules with no value imports: these are the limits Resend and the hosting
 * platform impose, and they are checked in three places — the browser before an
 * upload starts, the route handler that receives it, and the send itself. One
 * module so the three cannot disagree, and no I/O so all three can run it.
 *
 * The one thing that is not here is the deployment's per-file override, which
 * reads `process.env` and so lives in `limits.ts`. This file is the half the
 * browser imports.
 *
 * Every number below is Resend's, documented, with the source next to it:
 * https://resend.com/docs/dashboard/emails/attachments
 */

import type { EmailAttachment } from "@byteveda/db";

/**
 * Resend's ceiling: "Emails can be no larger than 40MB (including attachments
 * after Base64 encoding)."
 *
 * The phrase that matters is *after Base64 encoding*. A 40MB file is a 54MB
 * email and is refused; the raw budget is three quarters of this, and the HTML
 * and text parts come out of the same 40MB.
 */
export const RESEND_MAX_EMAIL_BYTES = 40 * 1024 * 1024;

/**
 * What one upload request may carry.
 *
 * Not Resend's limit — the platform's. A serverless function on Vercel rejects
 * a request body over 4.5MB before any of this code runs, with a 413 the
 * browser reports as a network error. So a file arrives on its own, one per
 * request, and a 40MB email is assembled from several of them. 4MB leaves room
 * for the multipart framing.
 *
 * A deployment that is not behind that limit — a container, or a self-hosted
 * Node server — raises it with `ADMIN_MAX_ATTACHMENT_BYTES`. That is an
 * environment read, so it lives in `limits.ts`; this is what the browser has,
 * and what the checks below assume when nobody passes the resolved one in.
 */
export const DEFAULT_MAX_ATTACHMENT_BYTES = 4 * 1024 * 1024;

/**
 * Room left for everything in the message that is not an attachment: the MIME
 * boundaries, the part headers, the filenames, the addresses.
 *
 * A guess, deliberately generous. Being 200KB pessimistic costs nothing; being
 * one byte optimistic means Resend refuses the send after the operator has
 * spent a minute uploading.
 */
export const MIME_OVERHEAD_BYTES = 256 * 1024;

/**
 * How many bytes `n` raw bytes take once Base64'd: four characters per three
 * bytes, rounded up to the next group.
 *
 * This is the conversion the 40MB limit is stated in terms of, so every total
 * in this file goes through it rather than comparing raw sizes and hoping.
 */
export function encodedSize(bytes: number): number {
  return Math.ceil(bytes / 3) * 4;
}

/**
 * The raw attachment bytes that fit, once the message body is accounted for.
 *
 * Quoted to the operator as "N MB left", so it is worth being exact rather than
 * saying 30MB and letting Resend deliver the bad news.
 */
export function remainingBytes(used: number, bodyBytes = 0): number {
  const budget = RESEND_MAX_EMAIL_BYTES - MIME_OVERHEAD_BYTES - bodyBytes;
  const spent = encodedSize(used);
  // Back from the encoded budget to raw bytes: 3 bytes per 4 characters.
  return Math.max(0, Math.floor(((budget - spent) * 3) / 4));
}

/**
 * Extensions Resend refuses to send.
 *
 * Verbatim from their knowledge base, which is worth keeping verbatim: this is
 * the Outlook blocked-extension list, and picking the "obvious" subset of it
 * means an attachment that uploads, stores, and then fails at the send with a
 * message about file types. Receiving any of these is fine — the restriction is
 * on sending, which is all this console does with them.
 */
export const BLOCKED_EXTENSIONS: readonly string[] = `
adp app asp bas bat cer chm cmd com cpl crt csh der exe fxp gadget hlp hta inf ins isp its
js jse ksh lib lnk mad maf mag mam maq mar mas mat mau mav maw mda mdb mde mdt mdw mdz msc
msh msh1 msh2 mshxml msh1xml msh2xml msi msp mst ops pcd pif plg prf prg reg scf scr sct shb
shs sys ps1 ps1xml ps2 ps2xml psc1 psc2 tmp url vb vbe vbs vps vsmacros vss vst vsw vxd ws
wsc wsf wsh xnk
`
  .trim()
  .split(/\s+/);

const BLOCKED = new Set(BLOCKED_EXTENSIONS);

/** The extension of a filename, lowercased, without the dot. Empty if it has none. */
export function extensionOf(filename: string): string {
  const dot = filename.lastIndexOf(".");
  if (dot <= 0 || dot === filename.length - 1) return "";
  return filename.slice(dot + 1).toLowerCase();
}

export function isBlocked(filename: string): boolean {
  return BLOCKED.has(extensionOf(filename));
}

/**
 * A filename safe to store and to put in a mail header.
 *
 * Path separators go because a filename is not a path — `../../etc/passwd` is a
 * name a browser will happily send. Control characters and quotes go because
 * this ends up inside a `Content-Disposition` header, where a quote ends the
 * value and a newline ends the header.
 */
export function safeFilename(filename: string): string {
  const base = filename.split(/[\\/]/).pop() ?? "";

  const cleaned = base
    // biome-ignore lint/suspicious/noControlCharactersInRegex: header injection is exactly what this strips
    .replace(/[\u0000-\u001f\u007f"]/g, "")
    .trim()
    .slice(0, 180);

  return cleaned || "attachment";
}

/** What is already attached, as far as the limits are concerned. */
export type Sized = { byteSize: number };

export function totalBytes(files: readonly Sized[]): number {
  return files.reduce((sum, file) => sum + file.byteSize, 0);
}

export type Refusal = { ok: false; message: string };
export type Accepted = { ok: true };
export type Verdict = Accepted | Refusal;

const ACCEPTED: Accepted = { ok: true };

/**
 * Whether one more file can be attached.
 *
 * Both limits in one answer, in the order the operator would hit them: the
 * file is too big on its own, or it does not fit alongside what is already
 * there. The message names the number, because "too large" without it sends
 * somebody back to the file manager to guess.
 *
 * `perFile` is the ceiling the deployment resolved. The server passes what
 * `maxFileBytes()` worked out; the browser has no environment to read and so
 * gets the default, which is exactly what it resolved before this was a
 * parameter.
 */
export function checkAttachment(
  candidate: { filename: string; byteSize: number },
  existing: readonly Sized[] = [],
  bodyBytes = 0,
  perFile = DEFAULT_MAX_ATTACHMENT_BYTES,
): Verdict {
  const { filename, byteSize } = candidate;

  if (byteSize <= 0) return { ok: false, message: `${filename} is empty.` };

  if (isBlocked(filename)) {
    return {
      ok: false,
      message: `Resend will not send .${extensionOf(filename)} files. Zip it, or put it somewhere and send the link.`,
    };
  }

  if (byteSize > perFile) {
    return {
      ok: false,
      message: `${filename} is ${formatBytes(byteSize)}. One file can be ${formatBytes(perFile)} at most — the upload is a single request, and the platform caps how large one can be.`,
    };
  }

  const left = remainingBytes(totalBytes(existing), bodyBytes);
  if (byteSize > left) {
    return {
      ok: false,
      message: `${filename} is ${formatBytes(byteSize)} and only ${formatBytes(left)} is left. Resend allows ${formatBytes(RESEND_MAX_EMAIL_BYTES)} per email once the files are Base64 encoded, which is a third larger than they are on disk.`,
    };
  }

  return ACCEPTED;
}

/**
 * Whether a message as a whole may be sent.
 *
 * Checked again at the send, not only at the upload. The body is written after
 * the files are chosen, a draft can sit for a day, and the per-file check
 * cannot know what the total will be by the time somebody presses send.
 */
export function checkMessage(files: readonly Sized[], bodyBytes = 0): Verdict {
  const encoded = encodedSize(totalBytes(files)) + bodyBytes + MIME_OVERHEAD_BYTES;

  if (encoded > RESEND_MAX_EMAIL_BYTES) {
    return {
      ok: false,
      message: `That message is about ${formatBytes(encoded)} once the ${files.length} file${files.length === 1 ? "" : "s"} are Base64 encoded, and Resend's limit is ${formatBytes(RESEND_MAX_EMAIL_BYTES)}. Remove something.`,
    };
  }

  return ACCEPTED;
}

/** Human sizes, base 1024, one decimal once past a megabyte. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Where a file waits between being chosen and being sent.
 *
 * Uploads are staged rather than posted with the message, and the reason is
 * arithmetic: Resend allows 40MB per email, a serverless request body allows
 * 4.5MB, and the only way to have both is one file per request with the message
 * assembled afterwards. `scope` is the composer it is waiting in.
 *
 * A staged row with no `message_id` is a file in a composer. Once the message
 * goes out the row is claimed by it, which is also what stops the sweep in
 * `store.ts` from taking it.
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

/** Reads `?scope=reply&for=<thread key>` into something typed, or nothing. */
export function parseScope(kind: string | null, id: string | null): AttachmentScope | null {
  if (!id) return null;
  if (kind === "reply") return { kind: "reply", id };
  if (kind === "compose") return { kind: "compose", id };
  if (kind === "broadcast") return { kind: "broadcast", id };
  return null;
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
