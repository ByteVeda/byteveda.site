import { type AdminUser, adminUsers, getDb, sessions } from "@byteveda/db";
import { asc, desc, eq, gt, sql } from "drizzle-orm";
import { superAdmins } from "@/lib/auth/allowlist";
import { type AccessSnapshot, accessFor } from "@/lib/auth/roles";

/** A member as the access page shows them: the row, plus what it resolves to. */
export type Member = {
  user: AdminUser;
  access: AccessSnapshot;
  /** Sessions open right now. A suspend that leaves one behind is not a suspend. */
  activeSessions: number;
};

export async function findMemberByGithubId(githubId: number): Promise<AdminUser | null> {
  const [row] = await getDb()
    .select()
    .from(adminUsers)
    .where(eq(adminUsers.githubId, githubId))
    .limit(1);

  return row ?? null;
}

export async function findMember(id: string): Promise<AdminUser | null> {
  const [row] = await getDb().select().from(adminUsers).where(eq(adminUsers.id, id)).limit(1);
  return row ?? null;
}

/**
 * Everyone with access, and what it amounts to.
 *
 * Ordered so the page reads as a list of people rather than a table sorted by
 * an accident: whoever has signed in most recently first, and the invitations
 * nobody has accepted after them — a row with no login is a pending invite,
 * and it belongs at the bottom where it can be chased.
 *
 * The session count is one grouped read rather than a query per member.
 */
export async function listMembers(): Promise<Member[]> {
  const db = getDb();
  const supers = superAdmins();

  const [rows, open] = await Promise.all([
    db.select().from(adminUsers).orderBy(desc(adminUsers.lastLoginAt), asc(adminUsers.createdAt)),

    db
      .select({ userId: sessions.userId, total: sql<number>`count(*)::int` })
      .from(sessions)
      .where(gt(sessions.expiresAt, new Date()))
      .groupBy(sessions.userId),
  ]);

  const counted = new Map(open.map((row) => [row.userId, row.total]));

  return rows.map((user) => ({
    user,
    access: accessFor(user, supers.includes(user.githubId)),
    activeSessions: counted.get(user.id) ?? 0,
  }));
}
