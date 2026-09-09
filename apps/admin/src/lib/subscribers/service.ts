import { randomBytes } from "node:crypto";
import { getDb, type Subscriber, subscribers } from "@byteveda/db";
import { eq } from "drizzle-orm";
import { sendEmail } from "@/lib/email/client";
import { confirmationEmail } from "@/lib/email/templates";
import { announce } from "@/lib/events";
import { getSettings } from "@/lib/settings";

export type SubscribeOutcome =
  | { ok: true; state: "pending" | "already-active" }
  | { ok: false; reason: string };

const EMAIL_SHAPE = /^[^@\s]+@[^@\s.]+\.[^@\s]+$/;

export function newToken(): string {
  return randomBytes(24).toString("base64url");
}

export function normalise(email: string): string {
  return email.trim().toLowerCase();
}

export function confirmUrl(origin: string, token: string): string {
  return `${origin.replace(/\/$/, "")}/s/confirm?token=${encodeURIComponent(token)}`;
}

export function unsubscribeUrl(origin: string, token: string): string {
  return `${origin.replace(/\/$/, "")}/s/unsubscribe?token=${encodeURIComponent(token)}`;
}

/**
 * Takes a signup and sends the confirmation.
 *
 * Never reports whether an address was already on the list. That answer would
 * turn a public endpoint into a way of testing whether someone is subscribed.
 */
export async function subscribe(input: {
  email: string;
  source: string;
  origin: string;
}): Promise<SubscribeOutcome> {
  const email = normalise(input.email);
  if (!EMAIL_SHAPE.test(email))
    return { ok: false, reason: "That does not look like an email address." };

  const settings = await getSettings();
  if (!settings["newsletter.enabled"]) {
    return { ok: false, reason: "The newsletter is not accepting signups right now." };
  }

  const db = getDb();
  const [existing] = await db
    .select()
    .from(subscribers)
    .where(eq(subscribers.email, email))
    .limit(1);

  if (existing?.status === "active") return { ok: true, state: "already-active" };

  // A returning address keeps its row: unsubscribing then signing up again
  // should work, and re-confirmation is what re-establishes consent.
  const token = existing?.token ?? newToken();
  if (existing) {
    await db
      .update(subscribers)
      .set({ status: "pending", unsubscribedAt: null, source: input.source })
      .where(eq(subscribers.id, existing.id));
  } else {
    await db.insert(subscribers).values({ email, token, source: input.source, status: "pending" });
  }

  announce("subscribers:changed");

  await sendEmail({
    to: email,
    email: confirmationEmail(confirmUrl(input.origin, token)),
    kind: "confirmation",
  });

  return { ok: true, state: "pending" };
}

export type TokenOutcome = { ok: boolean; message: string };

/** What a token currently points at, decided by the page before it offers a button. */
export type TokenState =
  | { found: false }
  | { found: true; email: string; status: Subscriber["status"] };

/**
 * Reads the state a token names, and changes nothing.
 *
 * The page behind an emailed link must not mutate on GET: scanners and
 * prefetchers follow those links, and a confirmation that happens because a
 * mail client looked at the message is not consent. The button does the change.
 */
export async function lookupByToken(token: string): Promise<TokenState> {
  if (!token) return { found: false };

  const [subscriber] = await getDb()
    .select({ email: subscribers.email, status: subscribers.status })
    .from(subscribers)
    .where(eq(subscribers.token, token))
    .limit(1);

  return subscriber
    ? { found: true, email: subscriber.email, status: subscriber.status }
    : { found: false };
}

export async function confirm(token: string): Promise<TokenOutcome> {
  if (!token) return { ok: false, message: "That link is missing its token." };

  const db = getDb();
  const [subscriber] = await db
    .select()
    .from(subscribers)
    .where(eq(subscribers.token, token))
    .limit(1);

  if (!subscriber) return { ok: false, message: "That link is not valid." };
  if (subscriber.status === "active") return { ok: true, message: "You are already subscribed." };

  await db
    .update(subscribers)
    .set({ status: "active", confirmedAt: new Date(), unsubscribedAt: null })
    .where(eq(subscribers.id, subscriber.id));

  // The console is watching; this is what moves the row from pending to
  // confirmed on a page nobody is touching.
  announce("subscribers:changed");

  return { ok: true, message: "You are subscribed." };
}

export async function unsubscribe(token: string): Promise<TokenOutcome> {
  if (!token) return { ok: false, message: "That link is missing its token." };

  const db = getDb();
  const [subscriber] = await db
    .select()
    .from(subscribers)
    .where(eq(subscribers.token, token))
    .limit(1);

  if (!subscriber) return { ok: false, message: "That link is not valid." };
  if (subscriber.status === "unsubscribed") {
    return { ok: true, message: "You were already unsubscribed." };
  }

  await db
    .update(subscribers)
    .set({ status: "unsubscribed", unsubscribedAt: new Date() })
    .where(eq(subscribers.id, subscriber.id));

  announce("subscribers:changed");

  return { ok: true, message: "You will not hear from us again." };
}
