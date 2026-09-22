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
  ADMIN_PERMISSIONS,
  ADMIN_ROLE_LABELS,
  type AdminPermission,
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
 * The list itself moved to `@byteveda/db/constants` when custom roles arrived:
 * a role's permissions are now a column, and the column's type should be the
 * closed set rather than `text[]`. Re-exported under the name the rest of this
 * app has always used, because where the strings are written down is not worth
 * a rename across forty files.
 */
export const PERMISSIONS = ADMIN_PERMISSIONS;

export type Permission = AdminPermission;

/**
 * The one permission no role may carry, custom or otherwise.
 *
 * `members.manage` is the grant that grants grants. A role holding it could
 * write itself every other line in this file, which would make the rest of
 * them advisory — so the built-in sets leave it out, and `sanitise` strips it
 * from anything a form sends. Only the hardcoded super admin list has it.
 */
export const RESERVED_PERMISSIONS: readonly Permission[] = ["members.manage"];

/**
 * Filters an untrusted list down to permissions that exist and may be granted.
 *
 * Every path that writes permissions goes through here — the custom role
 * editor, the per-member overrides, both of them server actions that are
 * public URLs. The returned list is in catalogue order rather than the order
 * it arrived in, so two equal sets compare equal and a diff of the column is
 * a real change.
 */
export function sanitisePermissions(values: readonly string[]): Permission[] {
  const asked = new Set(values);
  return PERMISSIONS.filter(
    (permission) => asked.has(permission) && !RESERVED_PERMISSIONS.includes(permission),
  );
}

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
  /**
   * The role a super admin wrote, when they are on one. Takes the place of
   * `role` — which is kept underneath it, and is what they fall back to if
   * this role is ever deleted.
   */
  customRole: { id: string; key: string; label: string } | null;
  superAdmin: boolean;
  permissions: readonly Permission[];
  /** Which mail they may read. Every workspace, for a super admin. */
  workspaces: readonly MailWorkspace[];
  /** Their exceptions to the role, kept so the console can show which is which. */
  extra: readonly Permission[];
  denied: readonly Permission[];
};

/** A custom role, in the shape the resolver needs. The row satisfies it. */
export type CustomRoleGrant = {
  id: string;
  key: string;
  label: string;
  permissions: readonly Permission[];
};

/** What a member is on, whichever kind of role that is. */
export type RoleChoice =
  | { kind: "builtin"; key: AdminRole }
  | { kind: "custom"; id: string; key: string; label: string };

export function permissionsFor(role: AdminRole): readonly Permission[] {
  return ROLE_PERMISSIONS[role] ?? [];
}

/**
 * The permissions a member gets before their own exceptions are applied.
 *
 * One function so that the members page, the access dialog and `accessFor`
 * cannot disagree about what "inherited" means — the dialog draws a tick as
 * coming from the role, and the server decides whether it is an override, and
 * those two have to be the same sentence.
 */
export function basePermissionsFor(
  role: AdminRole,
  customRole: CustomRoleGrant | null | undefined,
): readonly Permission[] {
  return customRole ? customRole.permissions : permissionsFor(role);
}

/**
 * Role, plus exceptions, in catalogue order.
 *
 * Denied is applied last and wins over everything, including the role and an
 * `extra` that contradicts it. Any other ordering makes "take this away" a
 * suggestion, and the one case that matters — withdrawing a grant from
 * somebody in a hurry — is the case where it must not be.
 */
export function resolvePermissions(input: {
  role: AdminRole;
  customRole?: CustomRoleGrant | null;
  extra?: readonly Permission[];
  denied?: readonly Permission[];
}): Permission[] {
  const granted = new Set<Permission>([
    ...basePermissionsFor(input.role, input.customRole),
    ...(input.extra ?? []),
  ]);

  for (const permission of input.denied ?? []) granted.delete(permission);
  // Nothing stored may hold the reserved grant, but resolving is the last gate
  // before a check, and it costs one filter to make that true by construction.
  for (const permission of RESERVED_PERMISSIONS) granted.delete(permission);

  return PERMISSIONS.filter((permission) => granted.has(permission));
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
  user: {
    role: AdminRole;
    mailWorkspaces: readonly MailWorkspace[];
    extraPermissions?: readonly Permission[];
    deniedPermissions?: readonly Permission[];
  },
  superAdmin: boolean,
  customRole?: CustomRoleGrant | null,
): AccessSnapshot {
  if (superAdmin) {
    return {
      role: user.role,
      customRole: null,
      superAdmin: true,
      permissions: PERMISSIONS,
      workspaces: MAIL_WORKSPACES,
      extra: [],
      denied: [],
    };
  }

  const extra = user.extraPermissions ?? [];
  const denied = user.deniedPermissions ?? [];

  return {
    role: user.role,
    customRole: customRole
      ? { id: customRole.id, key: customRole.key, label: customRole.label }
      : null,
    superAdmin: false,
    permissions: resolvePermissions({ role: user.role, customRole, extra, denied }),
    workspaces: user.mailWorkspaces,
    extra,
    denied,
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

/**
 * How the role is named in the interface. Super admin is a rank, not a role.
 *
 * A custom role's own label wins over the built-in one underneath it: that
 * label is what the person granting access typed, and showing "Viewer" for
 * somebody on "Release manager" would describe a column rather than a grant.
 */
export function roleLabel(
  access: Pick<AccessSnapshot, "role" | "superAdmin"> & {
    customRole?: AccessSnapshot["customRole"];
  },
): string {
  if (access.superAdmin) return "Super admin";
  return access.customRole?.label ?? ADMIN_ROLE_LABELS[access.role];
}

/** Whether a member's grant differs from the role they are on. */
export function hasOverrides(access: Pick<AccessSnapshot, "extra" | "denied">): boolean {
  return access.extra.length > 0 || access.denied.length > 0;
}
