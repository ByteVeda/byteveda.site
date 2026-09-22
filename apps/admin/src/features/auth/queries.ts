import { adminCustomRoles, adminUsers, getDb, sessions } from "@byteveda/db";
import { and, eq, gt } from "drizzle-orm";
import { cookies } from "next/headers";
import { isSuperAdminId } from "./allowlist";
import { accessFor, SESSION_COOKIE, SESSION_TTL_MS, type SessionContext } from "./model";
import { hashToken } from "./session";

/** Past half its life, an active session is extended. */
const RENEW_AFTER_MS = SESSION_TTL_MS / 2;

/**
 * Resolves the current session, or null. Expiry is part of the query rather
 * than a check afterwards, so a stale row cannot authenticate even briefly.
 */
export async function getSession(): Promise<SessionContext | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const db = getDb();
  // The custom role joins here rather than being fetched when something asks
  // for it: `access` is resolved once per request and handed to the browser,
  // and a role read later would be a second answer to the same question.
  const [row] = await db
    .select({ session: sessions, user: adminUsers, customRole: adminCustomRoles })
    .from(sessions)
    .innerJoin(adminUsers, eq(sessions.userId, adminUsers.id))
    .leftJoin(adminCustomRoles, eq(adminUsers.customRoleId, adminCustomRoles.id))
    .where(and(eq(sessions.tokenHash, hashToken(token)), gt(sessions.expiresAt, new Date())))
    .limit(1);

  if (!row) return null;

  const superAdmin = isSuperAdminId(row.user.githubId);

  /*
   * Suspension takes effect on the next request, not on the next login.
   *
   * `suspendMember` deletes the member's sessions, so this is the second lock
   * on the same door — but it is the one that closes it for a session issued
   * in the same second, or one the delete missed because the row was written by
   * another instance. A super admin cannot be locked out this way; their access
   * does not come from the row.
   */
  if (!superAdmin && row.user.status !== "active") return null;

  let expiresAt = row.session.expiresAt;
  if (expiresAt.getTime() - Date.now() < RENEW_AFTER_MS) {
    expiresAt = new Date(Date.now() + SESSION_TTL_MS);
    await db
      .update(sessions)
      .set({ expiresAt, lastSeenAt: new Date() })
      .where(eq(sessions.id, row.session.id));
  }

  return {
    user: row.user,
    sessionId: row.session.id,
    expiresAt,
    access: accessFor(row.user, superAdmin, row.customRole),
  };
}
