import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Verifying a Resend webhook.
 *
 * Resend signs with Svix: an HMAC-SHA256 over `id.timestamp.body`, keyed by the
 * secret, sent as one or more space-separated `v1,<base64>` entries so a secret
 * can be rotated without dropping deliveries.
 *
 * Implemented here rather than pulling in the Svix SDK — it is this function
 * and nothing else, and a signature check is worth being able to read.
 */

/** How far a timestamp may be from now. Bounds replay of a captured request. */
const TOLERANCE_SECONDS = 5 * 60;

export type VerifyInput = {
  secret: string;
  /** Raw body exactly as received — re-serialising JSON changes the signature. */
  body: string;
  id: string | null;
  timestamp: string | null;
  signature: string | null;
  now?: number;
};

export type VerifyResult = { ok: true } | { ok: false; reason: string };

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function expectedSignature(secret: string, id: string, timestamp: string, body: string) {
  // The secret is `whsec_<base64>`; the bytes, not the printable form, key the HMAC.
  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  return createHmac("sha256", key).update(`${id}.${timestamp}.${body}`).digest("base64");
}

export function verifySignature(input: VerifyInput): VerifyResult {
  const { secret, body, id, timestamp, signature } = input;

  if (!secret) return { ok: false, reason: "RESEND_WEBHOOK_SECRET is not set." };
  if (!id || !timestamp || !signature) return { ok: false, reason: "Missing signature headers." };

  const sent = Number(timestamp);
  if (!Number.isFinite(sent)) return { ok: false, reason: "Malformed timestamp." };

  const now = Math.floor((input.now ?? Date.now()) / 1000);
  if (Math.abs(now - sent) > TOLERANCE_SECONDS) {
    return { ok: false, reason: "Timestamp outside the accepted window." };
  }

  const expected = expectedSignature(secret, id, timestamp, body);

  // Any one of the offered signatures matching is enough — that is what makes
  // a secret rotation seamless.
  for (const entry of signature.split(" ")) {
    const [version, value] = entry.split(",");
    if (version === "v1" && value && safeEqual(value, expected)) return { ok: true };
  }

  return { ok: false, reason: "No signature matched." };
}
