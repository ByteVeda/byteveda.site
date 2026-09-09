import { env } from "@/lib/env";

/**
 * The origin GitHub should send the browser back to. `ADMIN_URL` wins when set,
 * which is what a deployment behind a proxy with a rewritten Host needs;
 * otherwise the request's own origin keeps localhost and preview URLs working
 * without configuration.
 */
export function originOf(request: Request): string {
  const configured = env.adminUrl();
  if (configured) return configured.replace(/\/$/, "");
  return new URL(request.url).origin;
}

export function callbackUrl(request: Request): string {
  return `${originOf(request)}/api/auth/callback`;
}

/**
 * Guards the post-login redirect. Anything that is not a plain in-app path —
 * an absolute URL, a protocol-relative `//evil.com`, a backslash variant that
 * some browsers normalise — collapses to the dashboard.
 */
export function safeNext(next: string | null | undefined): string {
  if (!next) return "/";
  if (!next.startsWith("/")) return "/";
  if (next.startsWith("//") || next.startsWith("/\\")) return "/";
  return next;
}
