import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { type AdminUser, adminUsers, getDb, sessions } from "@byteveda/db";
import { and, eq, gt, lt } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, STATE_COOKIE } from "./constants";

export { SESSION_COOKIE, STATE_COOKIE };

/**
 * Two clocks, on purpose. The row in Postgres is the authority and rolls
 * forward while the operator is active, so an idle session dies in a week. The
 * cookie outlives it, which is what lets the roll happen at all — a React
 * Server Component may read cookies but may not write them, so the renewal
 * cannot reach the browser. The cookie's own expiry is therefore the hard
 * ceiling on one continuous login.
 */
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const COOKIE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
/** Past half its life, an active session is extended. */
const RENEW_AFTER_MS = SESSION_TTL_MS / 2;

export type SessionContext = {
  user: AdminUser;
  sessionId: string;
  expiresAt: Date;
};

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

/**
 * Issues a session and returns the raw token. Only its SHA-256 digest is
 * stored, so a dump of this table is not a set of working logins.
 *
 * Writing the cookie is the caller's job, because only route handlers and
 * server actions are allowed to do it.
 */
export async function createSession(
  userId: string,
  meta: { ip?: string | null; userAgent?: string | null } = {},
): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await getDb()
    .insert(sessions)
    .values({
      userId,
      tokenHash: hashToken(token),
      expiresAt,
      ip: meta.ip ?? null,
      userAgent: meta.userAgent?.slice(0, 500) ?? null,
    });

  return { token, expiresAt };
}

/**
 * Resolves the current session, or null. Expiry is part of the query rather
 * than a check afterwards, so a stale row cannot authenticate even briefly.
 */
export async function getSession(): Promise<SessionContext | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const db = getDb();
  const [row] = await db
    .select({ session: sessions, user: adminUsers })
    .from(sessions)
    .innerJoin(adminUsers, eq(sessions.userId, adminUsers.id))
    .where(and(eq(sessions.tokenHash, hashToken(token)), gt(sessions.expiresAt, new Date())))
    .limit(1);

  if (!row) return null;

  let expiresAt = row.session.expiresAt;
  if (expiresAt.getTime() - Date.now() < RENEW_AFTER_MS) {
    expiresAt = new Date(Date.now() + SESSION_TTL_MS);
    await db
      .update(sessions)
      .set({ expiresAt, lastSeenAt: new Date() })
      .where(eq(sessions.id, row.session.id));
  }

  return { user: row.user, sessionId: row.session.id, expiresAt };
}

/** For pages and actions that must not run without a signed-in operator. */
export async function requireSession(): Promise<SessionContext> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

/** Call from a server action or route handler — it writes to the cookie store. */
export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;

  if (token) {
    await getDb()
      .delete(sessions)
      .where(eq(sessions.tokenHash, hashToken(token)));
  }
  store.delete(SESSION_COOKIE);
}

/** Housekeeping. Nothing depends on it running; expiry is enforced in the query. */
export async function pruneExpiredSessions(): Promise<number> {
  const deleted = await getDb()
    .delete(sessions)
    .where(lt(sessions.expiresAt, new Date()))
    .returning({ id: sessions.id });
  return deleted.length;
}
