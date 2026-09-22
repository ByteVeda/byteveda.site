import { getDb, type OutboundKind, outboundMessages } from "@byteveda/db";
import { Resend } from "resend";
import { configured } from "@/lib/env";
import { loggable } from "@/lib/log";
import { getSettings } from "@/lib/settings";
import { checkMessage } from "./attachments";
import { fetchFailureReason, type InboundFetch } from "./inbound";
import type { Email } from "./templates";

export type SendResult = {
  ok: boolean;
  /** Resend's id for the message, when it accepted one. */
  id?: string;
  /** The row this console wrote, whether the send worked or not. */
  messageId?: string;
  error?: string;
};

/** A file to send with a message. Bytes, not a path: nothing here is hosted. */
export type Attachment = { filename: string; contentType: string; content: Buffer };

/**
 * Resend's default rate limit is five requests a second per team, and a
 * broadcast is one request per recipient.
 *
 * Unpaced, a twenty-address list is twenty requests as fast as Postgres can
 * hand over the addresses, and the ones past the fifth come back 429 — which
 * this console would record as twenty attempts and five deliveries. Spacing
 * them is four seconds nobody is watching.
 *
 * Per instance, not per team: two serverless instances sending at once can
 * still exceed it. That is the honest limit of doing this without a shared
 * counter, and it is enough for the case that actually occurs, which is one
 * broadcast looping in one function.
 */
const MIN_SEND_INTERVAL_MS = 1000 / 5;
let nextSlot = 0;

async function slot(): Promise<void> {
  const now = Date.now();
  const at = Math.max(now, nextSlot);
  nextSlot = at + MIN_SEND_INTERVAL_MS;

  if (at > now) await new Promise((resolve) => setTimeout(resolve, at - now));
}

/** True when Resend is wired up. Everything below degrades cleanly when it is not. */
export function emailConfigured(): boolean {
  return configured("RESEND_API_KEY");
}

let client: Resend | null = null;
function resend(): Resend {
  if (!client) client = new Resend(process.env.RESEND_API_KEY);
  return client;
}

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
  /**
   * Files to send with it.
   *
   * Posted as bytes on the send rather than as a hosted URL, which is the other
   * thing Resend's `path` field allows: a URL would have to be reachable by
   * Resend, which means publishing the file, which means a console attachment
   * becomes a public one. Never used with the batch endpoint — that endpoint
   * takes no attachments at all — and `sendMany` loops single sends for exactly
   * that reason.
   */
  attachments?: Attachment[];
}): Promise<SendResult> {
  const settings = await getSettings();
  const address = input.from || settings["email.fromAddress"];
  const from = `${settings["email.fromName"]} <${address}>`;
  const replyTo = input.replyTo || settings["email.replyTo"] || undefined;
  const attachments = input.attachments ?? [];

  const record = async (result: SendResult): Promise<SendResult> => {
    const [row] = await getDb()
      .insert(outboundMessages)
      .values({
        resendId: result.id ?? null,
        toEmail: input.to,
        fromEmail: address,
        subject: input.email.subject,
        kind: input.kind,
        threadKey: input.thread?.key ?? null,
        bodyText: input.thread?.body ?? "",
        broadcastId: input.broadcastId ?? null,
        error: result.error ?? null,
      })
      .returning({ id: outboundMessages.id });

    // The row id goes back to the caller so that whatever was attached can be
    // filed against the message that carried it.
    return { ...result, messageId: row?.id };
  };

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

  try {
    await slot();

    const { data, error } = await resend().emails.send({
      from,
      to: input.to,
      subject: input.email.subject,
      html: input.email.html,
      text: input.email.text,
      replyTo,
      ...(attachments.length > 0
        ? {
            attachments: attachments.map((file) => ({
              filename: file.filename,
              content: file.content,
              contentType: file.contentType,
            })),
          }
        : {}),
    });

    if (error) return record({ ok: false, error: error.message });
    return record({ ok: true, id: data?.id });
  } catch (error) {
    return record({ ok: false, error: error instanceof Error ? error.message : "Unknown error." });
  }
}

/**
 * Fetches the body of a message that arrived on the inbound webhook.
 *
 * Necessary because `email.received` announces an arrival without carrying it:
 * the payload is the envelope and an id, and `GET /emails/receiving/{id}` is
 * where the text and the HTML actually live.
 *
 * Never throws. A message whose body could not be fetched is still worth
 * keeping — the sender, the subject and the reply button all work — and the
 * console repairs the row the next time the thread is opened. What it does not
 * do any more is fail silently: the reason comes back with the failure so the
 * page that has an empty conversation on it can say why.
 *
 * `html_format` is left at its default, so inline images arrive as `data:` URIs
 * embedded in the HTML rather than as `cid:` references to attachments the
 * console would then have to resolve.
 */
export async function fetchInboundBody(emailId: string): Promise<InboundFetch> {
  if (!emailConfigured()) return { ok: false, reason: "RESEND_API_KEY is not set." };

  // The id and Resend's message both originate outside this system — the id
  // arrived on the webhook — so neither goes into the format string. See
  // `lib/log.ts` for what that buys.
  try {
    const { data, error } = await resend().emails.receiving.get(emailId);

    if (error) {
      console.error("[inbound] could not fetch %s: %s", loggable(emailId), loggable(error.message));
      return { ok: false, reason: fetchFailureReason(error) };
    }

    return {
      ok: true,
      body: { text: data?.text ?? null, html: data?.html ?? null, headers: data?.headers ?? null },
    };
  } catch (cause) {
    console.error("[inbound] could not fetch %s: %s", loggable(emailId), loggable(cause));
    return { ok: false, reason: "The console could not reach Resend." };
  }
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
