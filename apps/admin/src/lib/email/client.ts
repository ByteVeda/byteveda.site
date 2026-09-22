import { Resend } from "resend";
import { configured } from "@/lib/env";
import { loggable } from "@/shared/log";

/**
 * Resend, and nothing else.
 *
 * Every call this console makes to Resend goes through here, and nothing here
 * knows what a subscriber or a conversation is — what to send, and what to
 * write down about having sent it, is `features/mail`'s.
 */

/** A file to send with a message. Bytes, not a path: nothing here is hosted. */
export type Attachment = { filename: string; contentType: string; content: Buffer };

/** What one `emails.send` came back with. Never throws out of `sendMessage`. */
export type SendOutcome = { ok: true; id?: string } | { ok: false; error: string };

/** What one `emails.receiving.get` came back with. Never throws out of `receiveMessage`. */
export type ReceiveOutcome =
  | {
      ok: true;
      body: { text: string | null; html: string | null; headers: Record<string, string> | null };
    }
  | { ok: false; error: { name?: string; message?: string } }
  | { ok: false; unreachable: true };

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
 * Posts one message, paced against the rate limit.
 *
 * Attachments go as bytes on the send rather than as a hosted URL, which is the
 * other thing Resend's `path` field allows: a URL would have to be reachable by
 * Resend, which means publishing the file, which means a console attachment
 * becomes a public one. Never used with the batch endpoint — that endpoint
 * takes no attachments at all — which is why a broadcast loops single sends.
 */
export async function sendMessage(input: {
  from: string;
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
  attachments?: Attachment[];
}): Promise<SendOutcome> {
  const attachments = input.attachments ?? [];

  try {
    await slot();

    const { data, error } = await resend().emails.send({
      from: input.from,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
      replyTo: input.replyTo,
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

    if (error) return { ok: false, error: error.message };
    return { ok: true, id: data?.id };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Unknown error." };
  }
}

/**
 * Reads a message that arrived on the inbound webhook.
 *
 * Necessary because `email.received` announces an arrival without carrying it:
 * the payload is the envelope and an id, and `GET /emails/receiving/{id}` is
 * where the text and the HTML actually live.
 *
 * `html_format` is left at its default, so inline images arrive as `data:` URIs
 * embedded in the HTML rather than as `cid:` references to attachments the
 * console would then have to resolve.
 */
export async function receiveMessage(emailId: string): Promise<ReceiveOutcome> {
  // The id and Resend's message both originate outside this system — the id
  // arrived on the webhook — so neither goes into the format string. See
  // `shared/log.ts` for what that buys.
  try {
    const { data, error } = await resend().emails.receiving.get(emailId);

    if (error) {
      console.error("[inbound] could not fetch %s: %s", loggable(emailId), loggable(error.message));
      return { ok: false, error };
    }

    return {
      ok: true,
      body: { text: data?.text ?? null, html: data?.html ?? null, headers: data?.headers ?? null },
    };
  } catch (cause) {
    console.error("[inbound] could not fetch %s: %s", loggable(emailId), loggable(cause));
    return { ok: false, unreachable: true };
  }
}
