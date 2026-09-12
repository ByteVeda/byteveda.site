import { getDb, type OutboundKind, outboundMessages } from "@byteveda/db";
import { Resend } from "resend";
import { configured } from "@/lib/env";
import { loggable } from "@/lib/log";
import { getSettings } from "@/lib/settings";
import type { InboundBody } from "./inbound";
import type { Email } from "./templates";

export type SendResult = { ok: boolean; id?: string; error?: string };

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
}): Promise<SendResult> {
  const settings = await getSettings();
  const address = input.from || settings["email.fromAddress"];
  const from = `${settings["email.fromName"]} <${address}>`;
  const replyTo = input.replyTo || settings["email.replyTo"] || undefined;

  const record = async (result: SendResult) => {
    await getDb()
      .insert(outboundMessages)
      .values({
        resendId: result.id ?? null,
        toEmail: input.to,
        subject: input.email.subject,
        kind: input.kind,
        broadcastId: input.broadcastId ?? null,
        error: result.error ?? null,
      });
    return result;
  };

  if (!emailConfigured()) {
    return record({ ok: false, error: "RESEND_API_KEY is not set." });
  }

  try {
    const { data, error } = await resend().emails.send({
      from,
      to: input.to,
      subject: input.email.subject,
      html: input.email.html,
      text: input.email.text,
      replyTo,
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
 * Returns null rather than throwing. A message whose body could not be fetched
 * is still worth keeping — the sender, the subject and the reply button all
 * work — and the console repairs the row the next time the thread is opened.
 *
 * `html_format` is left at its default, so inline images arrive as `data:` URIs
 * embedded in the HTML rather than as `cid:` references to attachments the
 * console would then have to resolve.
 */
export async function fetchInboundBody(emailId: string): Promise<InboundBody | null> {
  if (!emailConfigured()) return null;

  // The id and Resend's message both originate outside this system — the id
  // arrived on the webhook — so neither goes into the format string. See
  // `lib/log.ts` for what that buys.
  try {
    const { data, error } = await resend().emails.receiving.get(emailId);

    if (error) {
      console.error("[inbound] could not fetch %s: %s", loggable(emailId), loggable(error.message));
      return null;
    }

    return { text: data?.text ?? null, html: data?.html ?? null, headers: data?.headers ?? null };
  } catch (cause) {
    console.error("[inbound] could not fetch %s", loggable(emailId), cause);
    return null;
  }
}

/**
 * Sends the same message to many addresses, one at a time.
 *
 * Sequential and unbatched on purpose: each recipient needs their own
 * unsubscribe link, so there is no single message to batch, and a list this
 * size does not justify the concurrency.
 */
export async function sendMany(
  recipients: { to: string; email: Email }[],
  options: { kind: OutboundKind; broadcastId?: string },
): Promise<{ sent: number; failed: number; firstError?: string }> {
  let sent = 0;
  let failed = 0;
  let firstError: string | undefined;

  for (const recipient of recipients) {
    const result = await sendEmail({ ...recipient, ...options });
    if (result.ok) {
      sent += 1;
    } else {
      failed += 1;
      firstError ??= result.error;
    }
  }

  return { sent, failed, firstError };
}
