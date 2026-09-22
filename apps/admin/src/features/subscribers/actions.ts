"use server";

import { getDb, subscribers } from "@byteveda/db";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { refuse } from "@/features/auth";
import { confirmationEmail, sendEmail } from "@/features/mail";
import { env } from "@/lib/env";
import { subscribersChanged } from "./events";
import { confirmUrl, newToken, normalise } from "./service";

export type SubscriberResult = { ok: boolean; message: string };

const EMAIL_SHAPE = /^[^@\s]+@[^@\s.]+\.[^@\s]+$/;

function origin(): string {
  return env.adminUrl() ?? "https://admin.byteveda.org";
}

/**
 * Adds an address by hand.
 *
 * Still goes through confirmation rather than landing as active: consent is the
 * point of double opt-in, and an address typed into the console has not given
 * any.
 */
export async function addSubscriber(email: string): Promise<SubscriberResult> {
  const refused = await refuse("subscribers.write");
  if (refused) return refused;

  const address = normalise(email);
  if (!EMAIL_SHAPE.test(address)) {
    return { ok: false, message: "That does not look like an email address." };
  }

  const db = getDb();
  const [existing] = await db
    .select()
    .from(subscribers)
    .where(eq(subscribers.email, address))
    .limit(1);

  if (existing) return { ok: false, message: "That address is already on the list." };

  const token = newToken();
  await db
    .insert(subscribers)
    .values({ email: address, token, source: "admin", status: "pending" });

  const sent = await sendEmail({
    to: address,
    email: confirmationEmail(confirmUrl(origin(), token)),
    kind: "confirmation",
  });

  subscribersChanged.publish();
  revalidatePath("/subscribers");

  return sent.ok
    ? { ok: true, message: `Confirmation sent to ${address}.` }
    : { ok: false, message: `Added, but the confirmation did not send: ${sent.error}` };
}

export async function resendConfirmation(id: string): Promise<SubscriberResult> {
  const refused = await refuse("subscribers.write");
  if (refused) return refused;

  const [subscriber] = await getDb()
    .select()
    .from(subscribers)
    .where(eq(subscribers.id, id))
    .limit(1);

  if (!subscriber) return { ok: false, message: "That subscriber no longer exists." };

  const sent = await sendEmail({
    to: subscriber.email,
    email: confirmationEmail(confirmUrl(origin(), subscriber.token)),
    kind: "confirmation",
  });

  return sent.ok
    ? { ok: true, message: `Confirmation resent to ${subscriber.email}.` }
    : { ok: false, message: sent.error ?? "It did not send." };
}

export async function removeSubscriber(id: string): Promise<SubscriberResult> {
  const refused = await refuse("subscribers.write");
  if (refused) return refused;

  await getDb().delete(subscribers).where(eq(subscribers.id, id));

  subscribersChanged.publish();
  revalidatePath("/subscribers");

  return { ok: true, message: "Removed." };
}
