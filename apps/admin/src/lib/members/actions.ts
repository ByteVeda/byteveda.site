"use server";

import {
  type AdminRole,
  type AdminStatus,
  adminCustomRoles,
  adminUsers,
  getDb,
} from "@byteveda/db";
import {
  ADMIN_ROLES,
  ADMIN_STATUSES,
  MAIL_WORKSPACES,
  type MailWorkspace,
} from "@byteveda/db/constants";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { isSuperAdminId } from "@/lib/auth/allowlist";
import { basePermissionsFor, type Permission, sanitisePermissions } from "@/lib/auth/roles";
import { refuse, requireSession, revokeSessionsFor } from "@/lib/auth/session";
import { findUserByLogin } from "@/lib/github/client";
import { findCustomRole, findMember } from "./queries";

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
  /** A custom role to start them on. The built-in `role` is kept underneath it. */
  customRoleId?: string | null;
  workspaces: string[];
}): Promise<MemberResult> {
  const refused = await guard();
  if (refused) return refused;

  const { user: actor } = await requireSession();

  const handle = input.handle.trim().replace(/^@/, "");
  if (!handle) return { ok: false, message: "Give a GitHub login or a numeric user id." };
  if (!isRole(input.role)) return { ok: false, message: "Pick a role." };

  const custom = input.customRoleId ? await findCustomRole(input.customRoleId) : null;
  if (input.customRoleId && !custom) {
    return { ok: false, message: "That role has been deleted. Reload and pick another." };
  }

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
      customRoleId: custom?.id ?? null,
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
 * What one member may do, and where, written in a single act.
 *
 * Three columns used to be three actions firing as fast as the boxes were
 * ticked. Granular access is not that shape: "editor, both inboxes, but no
 * publishing" is one decision, and applying its parts one at a time means a
 * window in which somebody is an editor who can publish — and a half-applied
 * grant if the person closes the tab. So the dialog gathers the whole answer
 * and this writes it once.
 *
 * `permissions` is the set the operator ticked — what they want to be true —
 * rather than a pair of override lists. The diff against the role is computed
 * here, which is what keeps an override *an override*: change the role later
 * and everything they did not explicitly touch follows it.
 */
export type AccessDraft = {
  /** A built-in role's key, or a custom role's id when `custom` is true. */
  role: string;
  custom: boolean;
  /** The effective permissions, as ticked. */
  permissions: string[];
  workspaces: string[];
};

export async function setMemberAccess(id: string, draft: AccessDraft): Promise<MemberResult> {
  const refused = await guard();
  if (refused) return refused;

  const member = await findMember(id);
  if (!member) return { ok: false, message: "That member no longer exists." };

  // Refused rather than applied. A super admin's permissions come from the
  // hardcoded list and `accessFor` never reads these columns for them, so a
  // change that appeared to work would be a lie about what happens next.
  if (isSuperAdminId(member.githubId)) {
    return {
      ok: false,
      message: `${member.login} is a super admin, which is set in lib/auth/roles.ts. Nothing here applies to them.`,
    };
  }

  const custom = draft.custom ? await findCustomRole(draft.role) : null;
  if (draft.custom && !custom) {
    return { ok: false, message: "That role has been deleted. Reload and pick another." };
  }

  if (!custom && !isRole(draft.role)) {
    return { ok: false, message: "That is not a role." };
  }

  // The built-in role underneath a custom one is kept rather than cleared, so
  // deleting the custom role drops them back to something rather than nothing.
  const role: AdminRole = custom ? member.role : (draft.role as AdminRole);

  const wanted = new Set(sanitisePermissions(draft.permissions));
  const base = basePermissionsFor(role, custom);

  const extra = [...wanted].filter((permission) => !base.includes(permission));
  const denied = base.filter((permission) => !wanted.has(permission));

  await getDb()
    .update(adminUsers)
    .set({
      role,
      customRoleId: custom?.id ?? null,
      extraPermissions: sanitisePermissions(extra),
      deniedPermissions: sanitisePermissions(denied),
      mailWorkspaces: cleanWorkspaces(draft.workspaces),
    })
    .where(eq(adminUsers.id, id));

  revalidatePath("/members");
  revalidatePath("/inbox");

  const label = custom?.label ?? role;
  const exceptions = extra.length + denied.length;

  return {
    ok: true,
    message: `${member.login} is now ${label}${
      exceptions > 0 ? ` with ${exceptions} exception${exceptions === 1 ? "" : "s"}` : ""
    }.`,
  };
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

/* ---------------------------------------------------------------- custom roles */

export type RoleDraft = {
  label: string;
  description: string;
  permissions: string[];
};

/**
 * A stable handle for a role, derived from its name.
 *
 * Kept when the label is edited later: the key is what a log line and a
 * support conversation say, and renaming "Release manager" to "Releases"
 * should not make last month's audit trail refer to something that no longer
 * exists.
 */
function slugify(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

/** The checks both writers share: a usable name, and at least one grant. */
function validateRole(
  draft: RoleDraft,
): { label: string; permissions: Permission[] } | MemberResult {
  const label = draft.label.trim().replace(/\s+/g, " ");

  if (label.length < 2) return { ok: false, message: "Give the role a name." };
  if (label.length > 48) return { ok: false, message: "That name is too long for a role." };

  // A role reserving the built-in names would put two different answers behind
  // one word in every dropdown in the console.
  if ((ADMIN_ROLES as readonly string[]).includes(label.toLowerCase())) {
    return { ok: false, message: `“${label}” is a built-in role. Pick another name.` };
  }

  const permissions = sanitisePermissions(draft.permissions);
  if (permissions.length === 0) {
    return { ok: false, message: "A role with no permissions grants nothing. Tick at least one." };
  }

  return { label, permissions };
}

function isRefusal(value: unknown): value is MemberResult {
  return typeof value === "object" && value !== null && "ok" in value;
}

/**
 * Writes a role of the operator's own.
 *
 * What it can hold is bounded by the same catalogue every built-in role is:
 * `sanitisePermissions` drops anything that is not a real permission and
 * anything reserved, so a custom role can only recombine grants the code
 * already enforces. It cannot mint a new power, and it cannot carry
 * `members.manage` — the grant that grants grants stays a super admin's.
 */
export async function createRole(draft: RoleDraft): Promise<MemberResult> {
  const refused = await guard();
  if (refused) return refused;

  const checked = validateRole(draft);
  if (isRefusal(checked)) return checked;

  const { user: actor } = await requireSession();
  const key = slugify(checked.label);
  if (!key) return { ok: false, message: "That name has no letters or digits in it." };

  const [created] = await getDb()
    .insert(adminCustomRoles)
    .values({
      key,
      label: checked.label,
      description: draft.description.trim() || null,
      permissions: checked.permissions,
      createdBy: actor.id,
    })
    .onConflictDoNothing({ target: adminCustomRoles.key })
    .returning({ label: adminCustomRoles.label });

  if (!created) return { ok: false, message: "A role with that name already exists." };

  revalidatePath("/members");
  return { ok: true, message: `“${created.label}” is ready to assign.` };
}

/**
 * Edits one.
 *
 * Every member on the role is affected at once, which is the point of a role
 * and the reason the dialog says how many that is before it saves. Their own
 * exceptions survive: those are stored as a diff against the role, so removing
 * a permission from the role removes it from everybody who inherited it and
 * leaves it with whoever was granted it by name.
 */
export async function updateRole(id: string, draft: RoleDraft): Promise<MemberResult> {
  const refused = await guard();
  if (refused) return refused;

  const checked = validateRole(draft);
  if (isRefusal(checked)) return checked;

  const [updated] = await getDb()
    .update(adminCustomRoles)
    .set({
      label: checked.label,
      description: draft.description.trim() || null,
      permissions: checked.permissions,
      updatedAt: new Date(),
    })
    .where(eq(adminCustomRoles.id, id))
    .returning({ label: adminCustomRoles.label });

  if (!updated) return { ok: false, message: "That role no longer exists." };

  revalidatePath("/members");
  revalidatePath("/inbox");
  return { ok: true, message: `“${updated.label}” updated.` };
}

/**
 * Deletes one.
 *
 * Nobody loses their account. The foreign key nulls `custom_role_id`, and the
 * built-in role kept underneath it takes over — which is why that column is
 * never cleared when a custom role is assigned. Tidying up a role should not
 * be a way to lock the console's last editor out.
 */
export async function deleteRole(id: string): Promise<MemberResult> {
  const refused = await guard();
  if (refused) return refused;

  const [deleted] = await getDb()
    .delete(adminCustomRoles)
    .where(eq(adminCustomRoles.id, id))
    .returning({ label: adminCustomRoles.label });

  if (!deleted) return { ok: false, message: "That role no longer exists." };

  revalidatePath("/members");
  revalidatePath("/inbox");
  return {
    ok: true,
    message: `“${deleted.label}” is gone. Anyone on it is back on their built-in role.`,
  };
}
