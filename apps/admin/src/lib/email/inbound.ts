import type { InboundMessage } from "@byteveda/db";
import { displayName, normaliseEmail, threadKeyFor } from "./thread";

/**
 * Turning a Resend inbound notification into a row.
 *
 * The shape that matters: `email.received` is a *notification*, not the message.
 * Its payload carries the envelope — who wrote, to which address, about what —
 * and nothing else. The body lives behind `GET /emails/receiving/{id}` and has
 * to be fetched separately, which is why this takes two arguments.
 *
 * Getting that wrong is invisible: every field the webhook does send is present
 * and correct, the row inserts cleanly, and the conversation simply has no text
 * in it. Which is exactly how it shipped.
 */

/** The envelope, as the webhook sends it. */
export type InboundEvent = {
  email_id: string;
  from: string;
  to?: string | string[];
  subject?: string;
  /**
   * Resend does not send these on the webhook. They are accepted anyway so a
   * replayed fixture, or a future payload that inlines a short message, is used
   * rather than ignored in favour of a second API call.
   */
  text?: string | null;
  html?: string | null;
  headers?: Record<string, string> | null;
};

/** The message, as `emails.receiving.get` returns it. */
export type InboundBody = {
  text?: string | null;
  html?: string | null;
  headers?: Record<string, string> | null;
};

export type InboundRow = Pick<
  InboundMessage,
  | "resendId"
  | "threadKey"
  | "fromEmail"
  | "fromName"
  | "toEmail"
  | "subject"
  | "text"
  | "html"
  | "headers"
>;

function firstRecipient(to: string | string[] | undefined): string {
  if (Array.isArray(to)) return to[0] ?? "";
  return to ?? "";
}

/**
 * Whether a row still needs its body fetched.
 *
 * Every message stored before the body fetch existed looks like this, so the
 * console can repair them on the way past rather than leaving a permanently
 * blank conversation behind.
 */
export function bodyMissing(message: Pick<InboundMessage, "text" | "html">): boolean {
  return !message.text.trim() && !message.html?.trim();
}

export function inboundRow(event: InboundEvent, body: InboundBody = {}): InboundRow {
  const subject = event.subject ?? "";

  // The fetched body wins: the webhook only ever carries these by accident, and
  // an empty string from it must not mask the real message.
  const text = body.text?.trim() ? body.text : (event.text ?? "");
  const html = body.html?.trim() ? body.html : (event.html ?? null);

  return {
    resendId: event.email_id,
    threadKey: threadKeyFor(event.from, subject),
    fromEmail: normaliseEmail(event.from),
    fromName: displayName(event.from),
    toEmail: normaliseEmail(firstRecipient(event.to)),
    subject,
    text,
    html,
    headers: body.headers ?? event.headers ?? null,
  };
}
