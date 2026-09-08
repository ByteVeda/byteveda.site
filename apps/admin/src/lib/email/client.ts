import { getDb, type OutboundKind, outboundMessages } from "@byteveda/db";
import { Resend } from "resend";
import { configured } from "@/lib/env";
import { getSettings } from "@/lib/settings";
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
}): Promise<SendResult> {
  const settings = await getSettings();
  const from = `${settings["email.fromName"]} <${settings["email.fromAddress"]}>`;
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
