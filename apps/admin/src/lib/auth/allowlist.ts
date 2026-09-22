/**
 * Who is a super admin.
 *
 * This file used to answer "who may sign in", and that question now has two
 * halves. The set below is the one that cannot be widened from inside the
 * console: it is a hardcoded list in `roles.ts`, plus whatever `ADMIN_GITHUB_IDS`
 * names, and both require a deploy to change. Everybody else is a row in
 * `admin_users` that a super admin created — see `lib/members/service.ts`.
 *
 * `ADMIN_GITHUB_IDS` survives as a fallback rather than as the way in. It is
 * how a deployment whose operators are not in the source list keeps working,
 * and how a preview environment admits somebody for an afternoon. It can only
 * widen the super-admin set, never narrow it.
 *
 * GitHub's numeric user ID rather than the login — a login can be changed, and
 * the freed name can then be registered by somebody else.
 */

import { SUPER_ADMIN_GITHUB_IDS } from "./roles";

export function parseAllowlist(raw: string | undefined): number[] {
  if (!raw) return [];

  return raw
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const id = Number(entry);
      if (!Number.isInteger(id) || id <= 0) {
        throw new Error(
          `ADMIN_GITHUB_IDS must be a comma-separated list of numeric GitHub user IDs — got "${entry}"`,
        );
      }
      return id;
    });
}

/**
 * The super admins, source list and environment merged.
 *
 * Throws only if both are empty, which would be a build with no way in at all.
 * A malformed `ADMIN_GITHUB_IDS` still throws from `parseAllowlist`: a typo in
 * the one variable that grants total access should stop the sign-in and say so,
 * not silently admit a shorter list.
 */
export function superAdmins(): number[] {
  const merged = new Set([
    ...SUPER_ADMIN_GITHUB_IDS,
    ...parseAllowlist(process.env.ADMIN_GITHUB_IDS),
  ]);

  if (merged.size === 0) {
    throw new Error(
      "There are no super admins, so nobody can sign in. Add your numeric GitHub user ID to SUPER_ADMIN_GITHUB_IDS in lib/auth/roles.ts, or to ADMIN_GITHUB_IDS.",
    );
  }

  return [...merged];
}

export function isSuperAdminId(githubId: number, ids = superAdmins()): boolean {
  return ids.includes(githubId);
}
