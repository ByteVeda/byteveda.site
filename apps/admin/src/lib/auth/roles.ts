/**
 * Who may do what, with no imports that reach the database.
 *
 * Deliberately a plain module: the rail, the members page and half a dozen
 * buttons are client components that have to ask the same questions the server
 * asks, and `@byteveda/db` drags `pg` into any bundle that touches it. Only the
 * constants module is safe to import here.
 *
 * The rule this file exists to keep: **the answer is computed in one place.**
 * A permission checked one way on the server and another way in the browser is
 * a permission that will eventually disagree with itself, and the version that
 * matters is whichever one an attacker skips.
 */

import {
  ADMIN_ROLE_LABELS,
  type AdminRole,
  MAIL_WORKSPACES,
  type MailWorkspace,
} from "@byteveda/db/constants";

/**
 * Super admins, hardcoded.
 *
 * In source rather than in the database or the environment, and that is the
 * whole point: nothing the console can write — no row, no form, no compromised
 * session — can add a name to this list. Changing it takes a commit and a
 * deploy, which is a reviewable, revertable, attributable act.
 *
 * GitHub's numeric user IDs rather than logins. A login can be renamed and the
 * freed name registered by somebody else; an ID is forever.
 *
 * `ADMIN_GITHUB_IDS` is read alongside this (see `allowlist.ts`) so that an
 * existing deployment, or a preview environment for somebody who is not listed
 * here, is not locked out by this file. It can only widen the set, it still
 * requires a deploy, and it is documented as the fallback rather than the way.
 */
export const SUPER_ADMIN_GITHUB_IDS: readonly number[] = [67143288, 56130065];

/**
 * Everything the console can be asked to allow.
 *
 * One flat list, named `resource.verb`. Groups of three — read, write, and the
 * irreversible one — because "may edit a post" and "may put it in front of the
 * public" are genuinely different grants, and so are "may read the mail" and
 * "may answer it as us".
 */
export const PERMISSIONS = [
  "posts.read",
  "posts.write",
  "posts.publish",
  "stats.read",
  "stats.write",
  "subscribers.read",
  "subscribers.write",
  "broadcasts.send",
  "mail.read",
  "mail.send",
  "mail.manage",
  "settings.read",
  "settings.write",
  "members.read",
  "members.manage",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

/**
 * What each role carries.
 *
 * Written out rather than derived from a hierarchy. A ladder — viewer ⊂ support
 * ⊂ editor ⊂ admin — reads well and is wrong: support answers mail and edits
 * nothing, an editor publishes posts and must not mail the list. Spelling each
 * one out is four lines longer and says what it means.
 *
 * `members.manage` appears nowhere. Managing people is the super admin's, and a
 * role that could grant roles would make every other line here advisory.
 */
const ROLE_PERMISSIONS: Record<AdminRole, readonly Permission[]> = {
  admin: [
    "posts.read",
    "posts.write",
    "posts.publish",
    "stats.read",
    "stats.write",
    "subscribers.read",
    "subscribers.write",
    "broadcasts.send",
    "mail.read",
    "mail.send",
    "mail.manage",
    "settings.read",
    "settings.write",
    "members.read",
  ],
  editor: [
    "posts.read",
    "posts.write",
    "posts.publish",
    "stats.read",
    "stats.write",
    "subscribers.read",
    "mail.read",
  ],
  support: [
    "posts.read",
    "stats.read",
    "subscribers.read",
    "subscribers.write",
    "mail.read",
    "mail.send",
    "mail.manage",
  ],
  viewer: ["posts.read", "stats.read", "subscribers.read", "mail.read"],
};

/**
 * What a signed-in operator may do, in a form that survives serialisation.
 *
 * Resolved once per request on the server and handed to the browser as-is, so
 * that `useAccess()` and `requirePermission()` are answering from the same
 * object rather than from two readings of the same rules.
 */
export type AccessSnapshot = {
  /** Their role as stored. Ignored entirely when `superAdmin` is true. */
  role: AdminRole;
  superAdmin: boolean;
  permissions: readonly Permission[];
  /** Which mail they may read. Every workspace, for a super admin. */
  workspaces: readonly MailWorkspace[];
};

export function permissionsFor(role: AdminRole): readonly Permission[] {
  return ROLE_PERMISSIONS[role] ?? [];
}

/**
 * Resolves what a member may do.
 *
 * `superAdmin` is an argument rather than something this function works out,
 * because working it out means reading `ADMIN_GITHUB_IDS` — and this module is
 * imported by client components, where that variable does not exist. A version
 * of this that read the environment would quietly return a different answer in
 * the browser than on the server, which is the one bug a shared rules module
 * must not have. `isSuperAdminId` in `allowlist.ts` is the only reader.
 *
 * A super admin's row is not consulted for anything but their name: their
 * permissions are the whole catalogue and their mail scope is every workspace,
 * whatever the columns happen to say. That is what makes the hardcoded list a
 * recovery path — a super admin demoted to `viewer` with no mailboxes by a bad
 * form submission still has the console.
 */
export function accessFor(
  user: { role: AdminRole; mailWorkspaces: readonly MailWorkspace[] },
  superAdmin: boolean,
): AccessSnapshot {
  if (superAdmin) {
    return {
      role: user.role,
      superAdmin: true,
      permissions: PERMISSIONS,
      workspaces: MAIL_WORKSPACES,
    };
  }

  return {
    role: user.role,
    superAdmin: false,
    permissions: permissionsFor(user.role),
    workspaces: user.mailWorkspaces,
  };
}

export function can(access: AccessSnapshot, permission: Permission): boolean {
  return access.permissions.includes(permission);
}

/** Every permission, or nothing. Convenience for a page that needs two of them. */
export function canAll(access: AccessSnapshot, ...permissions: Permission[]): boolean {
  return permissions.every((permission) => can(access, permission));
}

export function canAny(access: AccessSnapshot, ...permissions: Permission[]): boolean {
  return permissions.some((permission) => can(access, permission));
}

/**
 * Reading mail is two grants, not one: the permission and the workspace.
 *
 * Both are required, and neither implies the other — "support, ByteVeda only"
 * and "admin, academy only" are the two shapes this exists for.
 */
export function canReadWorkspace(access: AccessSnapshot, workspace: MailWorkspace): boolean {
  return can(access, "mail.read") && access.workspaces.includes(workspace);
}

/** The workspaces this operator may actually see, in a stable order. */
export function readableWorkspaces(access: AccessSnapshot): MailWorkspace[] {
  if (!can(access, "mail.read")) return [];
  return MAIL_WORKSPACES.filter((workspace) => access.workspaces.includes(workspace));
}

/** How the role is named in the interface. Super admin is a rank, not a role. */
export function roleLabel(access: Pick<AccessSnapshot, "role" | "superAdmin">): string {
  return access.superAdmin ? "Super admin" : ADMIN_ROLE_LABELS[access.role];
}
