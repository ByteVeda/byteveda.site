import { type AdminUser, adminUsers, getDb } from "@byteveda/db";
import { eq } from "drizzle-orm";
import { isSuperAdminId } from "@/lib/auth/allowlist";
import type { GitHubUser } from "@/lib/auth/github";
import { findMemberByGithubId } from "./queries";

/**
 * Whether a GitHub account gets in, and what its row says afterwards.
 *
 * Sign-in used to be one question — is this id on the allowlist — and is now
 * two, because access is granted in two different ways on purpose:
 *
 *  - a **super admin** is a hardcoded id. No row is required, and one is
 *    written on the way past so the console has a name and a face to show.
 *    Nothing inside the application can add to this set.
 *  - a **member** is a row somebody with `members.manage` created. The invite
 *    exists before the first login, which is what lets a role and a mail scope
 *    be decided by the person granting access rather than by whoever signs in.
 *
 * Anyone else is refused, and so is a member whose row has been suspended.
 * Refusals are reasons rather than a boolean: "you are not invited" and "your
 * access was withdrawn" are different sentences, and the login page says both.
 */
export type Admission =
  | { ok: true; user: AdminUser }
  | { ok: false; reason: "denied" | "suspended" };

/**
 * Admits a profile that has just proved who it is, and records the visit.
 *
 * The profile fields are refreshed on every login rather than only on insert:
 * an avatar, a display name and a login all change on GitHub's side, and a
 * console showing a two-year-old handle for the person who is signed in is
 * showing something it could have known was wrong.
 *
 * Role, status and mail scope are deliberately *not* in the update — they are
 * the grant, and a login must never be able to touch it. The insert sets them
 * only for a super admin, who has no grant to overwrite.
 */
export async function admit(profile: GitHubUser): Promise<Admission> {
  const db = getDb();
  const superAdmin = isSuperAdminId(profile.id);

  const profileFields = {
    login: profile.login,
    name: profile.name,
    email: profile.email,
    avatarUrl: profile.avatarUrl,
    lastLoginAt: new Date(),
  };

  if (superAdmin) {
    const [user] = await db
      .insert(adminUsers)
      .values({
        githubId: profile.id,
        ...profileFields,
        // Cosmetic. `accessFor` ignores both columns for a super admin; these
        // are what the members page shows if the hardcoded list ever drops them.
        role: "admin",
        mailWorkspaces: ["byteveda", "academy"],
      })
      .onConflictDoUpdate({ target: adminUsers.githubId, set: profileFields })
      .returning();

    return user ? { ok: true, user } : { ok: false, reason: "denied" };
  }

  // Not a super admin: the row has to already exist, and it has to be live.
  // Read before write, rather than updating and inspecting what came back —
  // otherwise a refused sign-in still stamps `last_login_at`, and the members
  // page then shows a suspended account as having just been in.
  const invited = await findMemberByGithubId(profile.id);
  if (!invited) return { ok: false, reason: "denied" };
  if (invited.status !== "active") return { ok: false, reason: "suspended" };

  const [user] = await db
    .update(adminUsers)
    .set(profileFields)
    .where(eq(adminUsers.id, invited.id))
    .returning();

  return user ? { ok: true, user } : { ok: false, reason: "denied" };
}
