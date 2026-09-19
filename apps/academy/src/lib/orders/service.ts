/**
 * Filing a request, which means recording it and sending two emails.
 *
 * What it is protecting is the fact that a sample costs nothing. With no
 * payment step the email address is the whole of the price, so the row in
 * `academy.sample_requests` is both the record of what was sent and the lock
 * that stops the catalogue being collected one free sheet at a time.
 *
 * Claim first, then send. The other order — send, then record — gives away a
 * second sheet to anything that arrives while the first send is in flight. The
 * cost of claiming first is that a failed send leaves a lock over an email
 * nobody received, so that case releases it again.
 */

import { randomBytes } from "node:crypto";
import { isConfigured as dbConfigured } from "@byteveda/db";
import { claimSample, hasClaimedSample, releaseSample } from "@byteveda/db/queries/academy";
import { Resend } from "resend";

import type { Email } from "@/lib/email/templates";
import { orderNotificationEmail, orderReceivedEmail } from "@/lib/email/templates";
import { configured, env } from "@/lib/env";
import type { ResolvedOrder } from "@/lib/orders/model";

export type SubmitResult =
  | { ok: true; reference: string }
  | { ok: false; reason: string; status: number };

export function ordersConfigured(): boolean {
  return configured("RESEND_API_KEY") && dbConfigured();
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

const OFFLINE = {
  ok: false,
  status: 503,
  reason: "Requests are offline right now. Email us and we will send the sample by hand.",
} as const satisfies SubmitResult;

const SPENT =
  "That address has already had its free sample. Reply to the email we sent if you need another chapter.";

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
    console.error("[samples] RESEND_API_KEY or DATABASE_URL is not set; the request was dropped.");
    return OFFLINE;
  }

  const { email, item, line } = order;
  const reference = newReference();

  try {
    // Asked before claiming so the common case gets a sentence rather than a
    // rejection. It is not the enforcement — see `claimSample`.
    if (await hasClaimedSample(email)) {
      return { ok: false, status: 409, reason: SPENT };
    }

    const claim = await claimSample({
      email,
      reference,
      kind: item.kind,
      chapterId: item.kind === "chapter" ? item.chapterId : null,
      title: line.title,
      detail: line.meta,
      request: item.kind === "custom" ? { ...item.request } : null,
      listValue: line.price,
    });

    if (!claim.ok) {
      // Lost the race against a request from the same address.
      return { ok: false, status: 409, reason: SPENT };
    }
  } catch (cause) {
    // A live database that cannot be reached is an incident, and the cap
    // cannot be enforced without it. Refuse rather than give a sheet away.
    console.error("[samples] could not reach the database: %s", cause);
    return OFFLINE;
  }

  // The work order: the copy of the request that gets acted on.
  const notified = await send({
    to: env.orderInbox(),
    email: orderNotificationEmail({ reference, email, line }),
    replyTo: email,
  });

  if (!notified.ok) {
    console.error("[samples] %s could not reach the inbox: %s", reference, notified.error);
    // Nothing was delivered, so the address keeps its sample.
    await releaseSample(email).catch((cause) => {
      console.error("[samples] %s could not release the claim: %s", reference, cause);
    });
    return {
      ok: false,
      status: 502,
      reason: "We could not file that request. Try again in a minute.",
    };
  }

  const receipted = await send({
    to: email,
    email: orderReceivedEmail({ reference, line }),
    replyTo: env.orderInbox(),
  });

  if (!receipted.ok) {
    // Logged, not surfaced: the request is filed and will be delivered.
    console.error("[samples] %s receipt failed: %s", reference, receipted.error);
  }

  return { ok: true, reference };
}
