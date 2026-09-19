/**
 * Filing a request, which for now means sending two emails.
 *
 * There is no payment step and no database row yet: the team inbox *is* the
 * order book, and what it receives today is a request for free samples. That
 * makes the team notification the one send that must succeed — if it fails the
 * request is lost, so the caller is told. The visitor's receipt is a courtesy on
 * top; a failure there is logged and the request still stands.
 */

import { randomBytes } from "node:crypto";
import { Resend } from "resend";

import type { Email } from "@/lib/email/templates";
import { orderNotificationEmail, orderReceivedEmail } from "@/lib/email/templates";
import { configured, env } from "@/lib/env";
import type { ResolvedOrder } from "@/lib/orders/model";

export type SubmitResult =
  | { ok: true; reference: string }
  | { ok: false; reason: string; status: number };

export function ordersConfigured(): boolean {
  return configured("RESEND_API_KEY");
}

let client: Resend | null = null;
function resend(): Resend {
  if (!client) client = new Resend(process.env.RESEND_API_KEY);
  return client;
}

/** Short, quotable, and unambiguous when read aloud over a phone. */
export function newReference(): string {
  return `BVA-${randomBytes(3).toString("hex").toUpperCase()}`;
}

async function send(input: {
  to: string;
  email: Email;
  replyTo?: string;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const { error } = await resend().emails.send({
      from: env.orderFrom(),
      to: input.to,
      subject: input.email.subject,
      html: input.email.html,
      text: input.email.text,
      replyTo: input.replyTo,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (cause) {
    return { ok: false, error: cause instanceof Error ? cause.message : "Unknown error." };
  }
}

export async function submitOrder(order: ResolvedOrder): Promise<SubmitResult> {
  if (!ordersConfigured()) {
    console.error("[orders] RESEND_API_KEY is not set; the request was dropped.");
    return {
      ok: false,
      status: 503,
      reason: "Requests are offline right now. Email us and we will send the samples by hand.",
    };
  }

  const reference = newReference();

  // The work order first: it is the copy of the request that gets acted on.
  const notified = await send({
    to: env.orderInbox(),
    email: orderNotificationEmail({ reference, ...order }),
    replyTo: order.email,
  });

  if (!notified.ok) {
    console.error("[orders] %s could not reach the inbox: %s", reference, notified.error);
    return {
      ok: false,
      status: 502,
      reason: "We could not file that request. Try again in a minute.",
    };
  }

  const receipted = await send({
    to: order.email,
    email: orderReceivedEmail({ reference, lines: order.lines }),
    replyTo: env.orderInbox(),
  });

  if (!receipted.ok) {
    // Logged, not surfaced: the request is filed and will be delivered.
    console.error("[orders] %s receipt failed: %s", reference, receipted.error);
  }

  return { ok: true, reference };
}
