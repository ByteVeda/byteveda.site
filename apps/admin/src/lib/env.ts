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

/** Where the console answers when nothing says otherwise. */
const DEFAULT_ADMIN_URL = "https://admin.byteveda.org";

export const env = {
  githubClientId: () => required("GITHUB_CLIENT_ID"),
  githubClientSecret: () => required("GITHUB_CLIENT_SECRET"),
  /** Explicit public origin. Unset means "derive it from the incoming request". */
  adminUrl: () => optional("ADMIN_URL"),
  /**
   * The console's origin for something written without a request to hand.
   *
   * A confirmation link and an unsubscribe link are composed while a broadcast
   * is being sent, which is nobody's page load — so unlike the OAuth callback
   * there is no incoming URL to fall back to, and the production host is the
   * only sane default. Trailing slash removed, because everything that uses
   * this appends a path to it.
   */
  adminOrigin: () => (optional("ADMIN_URL") ?? DEFAULT_ADMIN_URL).replace(/\/$/, ""),
  isProduction: () => process.env.NODE_ENV === "production",
};
