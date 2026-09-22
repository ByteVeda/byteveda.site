import { randomBytes } from "node:crypto";
import { getDb, sessions } from "@byteveda/db";
import { eq, lt } from "drizzle-orm";
import { cookies } from "next/headers";
import { SESSION_COOKIE, SESSION_TTL_MS } from "./model";
import { hashToken } from "./session";

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

/** Ends every session a member has. What suspending or removing one implies. */
export async function revokeSessionsFor(userId: string): Promise<number> {
  const deleted = await getDb()
    .delete(sessions)
    .where(eq(sessions.userId, userId))
    .returning({ id: sessions.id });
  return deleted.length;
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
