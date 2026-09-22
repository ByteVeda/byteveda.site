import {
  type AdminCustomRole,
  type AdminUser,
  adminCustomRoles,
  adminUsers,
  getDb,
  sessions,
} from "@byteveda/db";
import { asc, desc, eq, gt, sql } from "drizzle-orm";
import { type AccessSnapshot, accessFor, superAdmins } from "@/features/auth";

/** A member as the access page shows them: the row, plus what it resolves to. */
export type Member = {
  user: AdminUser;
  access: AccessSnapshot;
  /** Sessions open right now. A suspend that leaves one behind is not a suspend. */
  activeSessions: number;
};

/** A custom role, with the one number that says whether deleting it is safe. */
export type CustomRoleSummary = AdminCustomRole & { members: number };

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
    db
      .select({ user: adminUsers, customRole: adminCustomRoles })
      .from(adminUsers)
      .leftJoin(adminCustomRoles, eq(adminUsers.customRoleId, adminCustomRoles.id))
      .orderBy(desc(adminUsers.lastLoginAt), asc(adminUsers.createdAt)),

    db
      .select({ userId: sessions.userId, total: sql<number>`count(*)::int` })
      .from(sessions)
      .where(gt(sessions.expiresAt, new Date()))
      .groupBy(sessions.userId),
  ]);

  const counted = new Map(open.map((row) => [row.userId, row.total]));

  return rows.map(({ user, customRole }) => ({
    user,
    access: accessFor(user, supers.includes(user.githubId), customRole),
    activeSessions: counted.get(user.id) ?? 0,
  }));
}

/**
 * The roles a super admin has written, with how many people are on each.
 *
 * The count is what turns "delete" from a guess into a decision: deleting a
 * role nobody holds is tidying, and deleting one four people hold drops all
 * four back to the built-in role underneath. The dialog says which it is.
 */
export async function listCustomRoles(): Promise<CustomRoleSummary[]> {
  const db = getDb();

  const rows = await db
    .select({
      role: adminCustomRoles,
      members: sql<number>`count(${adminUsers.id})::int`,
    })
    .from(adminCustomRoles)
    .leftJoin(adminUsers, eq(adminUsers.customRoleId, adminCustomRoles.id))
    .groupBy(adminCustomRoles.id)
    .orderBy(asc(adminCustomRoles.label));

  return rows.map(({ role, members }) => ({ ...role, members }));
}

export async function findCustomRole(id: string): Promise<AdminCustomRole | null> {
  const [row] = await getDb()
    .select()
    .from(adminCustomRoles)
    .where(eq(adminCustomRoles.id, id))
    .limit(1);

  return row ?? null;
}
