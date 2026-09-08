/**
 * Who may sign in.
 *
 * The allowlist is an environment variable, not a database table, on purpose:
 * granting access should require a deploy, and no amount of write access to the
 * application can widen it.
 *
 * GitHub's numeric user ID rather than the login — a login can be changed, and
 * the freed name can then be registered by somebody else.
 */
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

export function allowlist(): number[] {
  const ids = parseAllowlist(process.env.ADMIN_GITHUB_IDS);
  if (ids.length === 0) {
    throw new Error(
      "ADMIN_GITHUB_IDS is empty, so nobody can sign in. Set it to your numeric GitHub user ID.",
    );
  }
  return ids;
}

export function isAllowed(githubId: number, ids = allowlist()): boolean {
  return ids.includes(githubId);
}
