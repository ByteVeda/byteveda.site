import type { OutboundKind } from "@byteveda/db";
import { checkMessage } from "@/features/attachments/model";
import { type Attachment, emailConfigured, receiveMessage, sendMessage } from "@/lib/email/client";
import { getSettings } from "@/lib/settings";
import { type Email, fetchFailureReason, type InboundFetch, type SendResult } from "./model";
import { recordOutbound } from "./store";

/**
 * Sends one message and records it.
 *
 * The row in `outbound_messages` is written whether the send succeeded or not,
 * so "did that go out?" is answerable from the console rather than from
 * Resend's dashboard — including for the sends that failed, which are the ones
 * worth asking about.
 */
export async function sendEmail(input: {
  to: string;
  email: Email;
  kind: OutboundKind;
  broadcastId?: string;
  replyTo?: string;
  /**
   * Send as this address instead of the configured one.
   *
   * For replies: someone who wrote to `conduct@byteveda.org` should get the
   * answer from `conduct@byteveda.org`, not from whatever the console happens to
   * announce posts as. Any address the console replies from arrived through
   * Resend's inbound routing, so it is on a domain Resend has already verified.
   */
  from?: string;
  /**
   * Files this send into a conversation, so it appears in the thread rather
   * than only in the send log.
   *
   * `body` is what the operator typed, not what was posted to Resend: the
   * quoting and the mail chrome in `replyEmail` exist for the recipient, who
   * cannot see the thread. In the console the thread is right there, and a
   * reply that repeats it is a reply nobody can read.
   *
   * Set on a failed send too. The attempt belongs in the conversation — with
   * its error on it — even though nothing was delivered.
   */
  thread?: { key: string; body: string };
  /** Files to send with it. */
  attachments?: Attachment[];
}): Promise<SendResult> {
  const settings = await getSettings();
  const address = input.from || settings["email.fromAddress"];
  const from = `${settings["email.fromName"]} <${address}>`;
  const replyTo = input.replyTo || settings["email.replyTo"] || undefined;
  const attachments = input.attachments ?? [];

  const record = (result: SendResult): Promise<SendResult> =>
    recordOutbound(
      {
        toEmail: input.to,
        fromEmail: address,
        subject: input.email.subject,
        kind: input.kind,
        threadKey: input.thread?.key ?? null,
        bodyText: input.thread?.body ?? "",
        broadcastId: input.broadcastId ?? null,
      },
      result,
    );

  if (!emailConfigured()) {
    return record({ ok: false, error: "RESEND_API_KEY is not set." });
  }

  /*
   * The 40MB check, immediately before the send.
   *
   * Also checked as each file is uploaded, but that check cannot know what the
   * message will look like by the time somebody presses send — the body is
   * typed afterwards, and a draft can sit for a day. Resend measures the email
   * *after* Base64, so the body is counted here too.
   */
  if (attachments.length > 0) {
    const bodyBytes =
      Buffer.byteLength(input.email.html, "utf8") + Buffer.byteLength(input.email.text, "utf8");

    const verdict = checkMessage(
      attachments.map((file) => ({ byteSize: file.content.byteLength })),
      bodyBytes,
    );

    if (!verdict.ok) return record({ ok: false, error: verdict.message });
  }

  const outcome = await sendMessage({
    from,
    to: input.to,
    subject: input.email.subject,
    html: input.email.html,
    text: input.email.text,
    replyTo,
    attachments,
  });

  return record(outcome);
}

/**
 * Fetches the body of a message that arrived on the inbound webhook.
 *
 * Never throws. A message whose body could not be fetched is still worth
 * keeping — the sender, the subject and the reply button all work — and the
 * console repairs the row the next time the thread is opened. What it does not
 * do any more is fail silently: the reason comes back with the failure so the
 * page that has an empty conversation on it can say why.
 */
export async function fetchInboundBody(emailId: string): Promise<InboundFetch> {
  if (!emailConfigured()) return { ok: false, reason: "RESEND_API_KEY is not set." };

  const result = await receiveMessage(emailId);

  if (result.ok) return { ok: true, body: result.body };
  if ("unreachable" in result) return { ok: false, reason: "The console could not reach Resend." };
  return { ok: false, reason: fetchFailureReason(result.error) };
}

/**
 * Sends the same message to many addresses, one at a time.
 *
 * Sequential and unbatched for two reasons, and the second one is newer. Each
 * recipient needs their own unsubscribe link, so there is no single message to
 * batch — and Resend's batch endpoint takes no attachments at all, so a
 * broadcast that carries a file could not use it even if there were. `sendEmail`
 * paces itself at five requests a second, which is the rate limit this loop
 * would otherwise walk straight through.
 *
 * `firstMessageId` is the row the attachments are filed against. One copy of a
 * file for a hundred recipients, rather than a hundred: the broadcast row is
 * the record that it went out, and this is the record of what went with it.
 */
export async function sendMany(
  recipients: { to: string; email: Email }[],
  options: { kind: OutboundKind; broadcastId?: string; attachments?: Attachment[] },
): Promise<{ sent: number; failed: number; firstError?: string; firstMessageId?: string }> {
  let sent = 0;
  let failed = 0;
  let firstError: string | undefined;
  let firstMessageId: string | undefined;

  for (const recipient of recipients) {
    const result = await sendEmail({ ...recipient, ...options });
    if (result.ok) {
      sent += 1;
      firstMessageId ??= result.messageId;
    } else {
      failed += 1;
      firstError ??= result.error;
    }
  }

  return { sent, failed, firstError, firstMessageId };
}
