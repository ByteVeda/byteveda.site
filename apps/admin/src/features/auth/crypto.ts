import { createHash, timingSafeEqual } from "node:crypto";
import { COOKIE_TTL_MS } from "./model";

/**
 * The pure helpers that cannot live in `model.ts`.
 *
 * Hashing a token, comparing two secrets and describing a cookie are as free of
 * I/O as anything in the model, but they reach `node:crypto` and `process.env`,
 * and `model.ts` is imported by client components and by the edge proxy.
 * Keeping them one file across that line is what lets the model stay cheap.
 *
 * Named for what they are rather than for the session: the session's read is
 * `queries.ts`, its writes are `store.ts` and its orchestration is `service.ts`,
 * and `safeEqual`'s only caller outside this feature compares OAuth state.
 */

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Length-safe constant-time comparison, for values an attacker can vary. */
export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    // Lax rather than Strict: the OAuth callback is a top-level navigation from
    // github.com, and Strict would withhold the cookie exactly then.
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: Math.floor(COOKIE_TTL_MS / 1000),
  };
}
