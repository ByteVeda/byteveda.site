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
import { after } from "next/server";
import { Resend } from "resend";
import { configured, env } from "@/lib/env";
import type { ResolvedOrder } from "./model";
import type { Email } from "./templates";
import { orderNotificationEmail, orderReceivedEmail } from "./templates";

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

/**
 * How long each step of a request took, as one line.
 *
 * A request that answers slowly has three places to be slow in — two round
 * trips to Postgres and one to Resend — and from outside they are one number.
 * Marks are deltas rather than totals so the line names the step to blame
 * rather than leaving it to be subtracted.
 */
function stopwatch() {
  const marks: string[] = [];
  let last = performance.now();

  return {
    mark(step: string) {
      const now = performance.now();
      marks.push(`${step} ${Math.round(now - last)}ms`);
      last = now;
    },
    summary(): string {
      return marks.join(", ");
    },
  };
}

/**
 * What actually went wrong, down the chain of causes.
 *
 * `%s` on the error drizzle throws prints the query and then `[cause]: [Error]`
 * — the wrapper, and a promise that the reason exists somewhere below it. That
 * cost an incident: a certificate Node would not verify and a table that did not
 * exist both read as "could not reach the database".
 */
function describe(error: unknown, depth = 4): string {
  const parts: string[] = [];

  for (let cause = error, step = 0; cause && step < depth; step++) {
    if (typeof cause !== "object") {
      parts.push(String(cause));
      break;
    }
    const { message, code } = cause as { message?: string; code?: string };
    if (message) parts.push(code ? `${message} (${code})` : message);
    cause = (cause as { cause?: unknown }).cause;
  }

  return parts.join(" <- ") || String(error);
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
    console.error("[samples] RESEND_API_KEY or DATABASE_URL is not set; the request was dropped.");
    return OFFLINE;
  }

  const { email, item, line } = order;
  const reference = newReference();
  const elapsed = stopwatch();

  try {
    // Asked before claiming so the common case gets a sentence rather than a
    // rejection. It is not the enforcement — see `claimSample`.
    if (await hasClaimedSample(email)) {
      return { ok: false, status: 409, reason: SPENT };
    }
    elapsed.mark("check");

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
    elapsed.mark("claim");

    if (!claim.ok) {
      // Lost the race against a request from the same address.
      return { ok: false, status: 409, reason: SPENT };
    }
  } catch (cause) {
    // A live database that cannot be reached is an incident, and the cap
    // cannot be enforced without it. Refuse rather than give a sheet away.
    console.error(`[samples] could not reach the database: ${describe(cause)}`);
    return OFFLINE;
  }

  // The work order: the copy of the request that gets acted on.
  const notified = await send({
    to: env.orderInbox(),
    email: orderNotificationEmail({ reference, email, line }),
    replyTo: email,
  });
  elapsed.mark("notify");

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

  // The receipt is not part of the answer. Its failure is already logged rather
  // than surfaced — the request is filed and will be delivered either way — so
  // waiting for it only holds the visitor on a spinner for the length of a
  // second round trip to Resend. `after` sends it once the response is gone.
  after(async () => {
    const receipted = await send({
      to: email,
      email: orderReceivedEmail({ reference, line }),
      replyTo: env.orderInbox(),
    });

    if (!receipted.ok) {
      console.error("[samples] %s receipt failed: %s", reference, receipted.error);
    }
  });

  console.log(`[samples] ${reference} filed — ${elapsed.summary()}`);
  return { ok: true, reference };
}
