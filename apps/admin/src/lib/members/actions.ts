"use server";

import { type AdminRole, type AdminStatus, adminUsers, getDb } from "@byteveda/db";
import {
  ADMIN_ROLES,
  ADMIN_STATUSES,
  MAIL_WORKSPACES,
  type MailWorkspace,
} from "@byteveda/db/constants";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { isSuperAdminId } from "@/lib/auth/allowlist";
import { findUserByLogin } from "@/lib/auth/github";
import { refuse, requireSession, revokeSessionsFor } from "@/lib/auth/session";
import { findMember } from "./queries";

export type MemberResult = { ok: boolean; message: string };

/**
 * Managing people is the super admin's, and `members.manage` is only in the
 * super admin's permission set — so this one check covers every action here.
 *
 * Each action calls it for itself rather than trusting the page that rendered
 * the button. A server action is an endpoint with its own URL; the only thing
 * between a demoted operator and a role change is this line.
 */
async function guard(): Promise<MemberResult | null> {
  return refuse("members.manage");
}

function isRole(value: string): value is AdminRole {
  return (ADMIN_ROLES as readonly string[]).includes(value);
}

function isStatus(value: string): value is AdminStatus {
  return (ADMIN_STATUSES as readonly string[]).includes(value);
}

/** Drops anything that is not a known workspace, and de-duplicates the rest. */
function cleanWorkspaces(values: string[]): MailWorkspace[] {
  return MAIL_WORKSPACES.filter((workspace) => values.includes(workspace));
}

/**
 * Invites somebody by GitHub login, or by numeric id.
 *
 * The login is resolved to an id before anything is written, because the id is
 * the identity: a login can be renamed and the freed name registered by a
 * stranger, and a grant that followed the name would follow it to them. What
 * the row keeps of the login is a label, refreshed at every sign-in.
 *
 * Nothing is emailed. There is no invitation to accept — the row *is* the
 * access, and the person simply signs in with GitHub when they are told to.
 */
export async function inviteMember(input: {
  handle: string;
  role: string;
  workspaces: string[];
}): Promise<MemberResult> {
  const refused = await guard();
  if (refused) return refused;

  const { user: actor } = await requireSession();

  const handle = input.handle.trim().replace(/^@/, "");
  if (!handle) return { ok: false, message: "Give a GitHub login or a numeric user id." };
  if (!isRole(input.role)) return { ok: false, message: "Pick a role." };

  const numeric = /^\d+$/.test(handle) ? Number(handle) : null;
  const profile = numeric === null ? await findUserByLogin(handle) : null;

  if (numeric === null && !profile) {
    return {
      ok: false,
      message: `GitHub has no public account called “${handle}”. If it exists and this keeps failing, paste the numeric user id instead — GitHub rate limits this lookup.`,
    };
  }

  const githubId = profile?.id ?? (numeric as number);
  if (!Number.isInteger(githubId) || githubId <= 0) {
    return { ok: false, message: "That is not a GitHub user id." };
  }

  const workspaces = cleanWorkspaces(input.workspaces);

  const [created] = await getDb()
    .insert(adminUsers)
    .values({
      githubId,
      login: profile?.login ?? String(githubId),
      name: profile?.name ?? null,
      avatarUrl: profile?.avatarUrl ?? null,
      role: input.role,
      status: "active",
      mailWorkspaces: workspaces,
      invitedBy: actor.id,
    })
    // Somebody already in the console is not invited again. Their role is
    // changed with the control beside their name, which is a different act and
    // reads as one.
    .onConflictDoNothing({ target: adminUsers.githubId })
    .returning({ login: adminUsers.login });

  if (!created) return { ok: false, message: "That account already has access." };

  revalidatePath("/members");
  return { ok: true, message: `${created.login} can sign in now.` };
}

/**
 * Changes what a member may do.
 *
 * A super admin's role is not editable here, and refusing is better than
 * silently ignoring it: their access comes from the hardcoded list, so a
 * successful-looking change to the column would be a lie about what the console
 * will do next.
 */
export async function setMemberRole(id: string, role: string): Promise<MemberResult> {
  const refused = await guard();
  if (refused) return refused;

  if (!isRole(role)) return { ok: false, message: "That is not a role." };

  const member = await findMember(id);
  if (!member) return { ok: false, message: "That member no longer exists." };
  if (isSuperAdminId(member.githubId)) {
    return {
      ok: false,
      message: `${member.login} is a super admin. That is set in the source, not here.`,
    };
  }

  await getDb().update(adminUsers).set({ role }).where(eq(adminUsers.id, id));

  revalidatePath("/members");
  return { ok: true, message: `${member.login} is now a ${role}.` };
}

/** Which inboxes a member may read. Nothing to do with their role. */
export async function setMemberWorkspaces(id: string, workspaces: string[]): Promise<MemberResult> {
  const refused = await guard();
  if (refused) return refused;

  const [updated] = await getDb()
    .update(adminUsers)
    .set({ mailWorkspaces: cleanWorkspaces(workspaces) })
    .where(eq(adminUsers.id, id))
    .returning({ login: adminUsers.login });

  if (!updated) return { ok: false, message: "That member no longer exists." };

  revalidatePath("/members");
  revalidatePath("/inbox");
  return { ok: true, message: `Updated the mail access for ${updated.login}.` };
}

/**
 * Suspends a member, or lets them back in.
 *
 * Suspending ends their sessions there and then. Without that, withdrawing
 * access would mean nothing for up to a week — a session is a row in Postgres
 * with a seven-day life of its own, and the person holding one would keep the
 * console until it expired.
 */
export async function setMemberStatus(id: string, status: string): Promise<MemberResult> {
  const refused = await guard();
  if (refused) return refused;

  if (!isStatus(status)) return { ok: false, message: "That is not a status." };

  const { user: actor } = await requireSession();
  if (actor.id === id) return { ok: false, message: "Suspending yourself is not a thing." };

  const member = await findMember(id);
  if (!member) return { ok: false, message: "That member no longer exists." };

  // Refused rather than attempted. `getSession` and the sign-in gate both admit
  // a super admin from the hardcoded list without reading this column, so a
  // suspension that appeared to work would be a lie about who can get in.
  if (isSuperAdminId(member.githubId)) {
    return {
      ok: false,
      message: `${member.login} is a super admin, and that is set in lib/auth/roles.ts. Remove the id there to withdraw it.`,
    };
  }

  await getDb().update(adminUsers).set({ status }).where(eq(adminUsers.id, id));

  if (status === "active") {
    revalidatePath("/members");
    return { ok: true, message: `${member.login} can sign in again.` };
  }

  const ended = await revokeSessionsFor(id);

  revalidatePath("/members");
  return {
    ok: true,
    message: `${member.login} is suspended${ended > 0 ? ` and ${ended} session${ended === 1 ? "" : "s"} ended` : ""}.`,
  };
}

/**
 * Removes a member entirely.
 *
 * Their sessions go with the row — the foreign key cascades — and so does the
 * record that they were ever here. Suspending is the reversible one; this is
 * for somebody who should not appear in the list at all.
 */
export async function removeMember(id: string): Promise<MemberResult> {
  const refused = await guard();
  if (refused) return refused;

  const { user: actor } = await requireSession();
  if (actor.id === id) return { ok: false, message: "Removing yourself is not a thing." };

  const member = await findMember(id);
  if (!member) return { ok: false, message: "That member no longer exists." };

  if (isSuperAdminId(member.githubId)) {
    return {
      ok: false,
      message: `${member.login} is a super admin: the next sign-in writes the row straight back. Remove the id from lib/auth/roles.ts instead.`,
    };
  }

  await getDb().delete(adminUsers).where(eq(adminUsers.id, id));

  revalidatePath("/members");
  return { ok: true, message: `${member.login} no longer has access.` };
}
