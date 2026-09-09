/**
 * Environment access, read lazily.
 *
 * Every value is fetched at call time rather than at module load, so importing
 * a route that happens to touch this file cannot fail a build on a machine that
 * has no credentials — only actually using the feature does.
 */

export function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set. See apps/admin/.env.example.`);
  }
  return value;
}

export function optional(name: string): string | undefined {
  return process.env[name] || undefined;
}

/** True when the variables a feature needs are all present. */
export function configured(...names: string[]): boolean {
  return names.every((name) => Boolean(process.env[name]));
}

export const env = {
  githubClientId: () => required("GITHUB_CLIENT_ID"),
  githubClientSecret: () => required("GITHUB_CLIENT_SECRET"),
  /** Explicit public origin. Unset means "derive it from the incoming request". */
  adminUrl: () => optional("ADMIN_URL"),
  isProduction: () => process.env.NODE_ENV === "production",
};
