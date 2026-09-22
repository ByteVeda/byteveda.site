import { redirect } from "next/navigation";
import { can, type Permission, type SessionContext } from "./model";
import { getSession } from "./queries";

/** For pages and actions that must not run without a signed-in operator. */
export async function requireSession(): Promise<SessionContext> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

/**
 * For a page that a role may not be allowed to see at all.
 *
 * Bounces to the overview with the refused permission named, rather than
 * rendering an empty version of the page. The rail does not show a link the
 * operator cannot follow, so arriving here means a typed URL, a bookmark from
 * before a role changed, or a stale tab — and each of those deserves the
 * sentence the overview prints instead of a page with nothing on it.
 */
export async function requirePermission(permission: Permission): Promise<SessionContext> {
  const session = await requireSession();
  if (!can(session.access, permission)) redirect(`/?denied=${encodeURIComponent(permission)}`);
  return session;
}

/**
 * For a server action, which cannot redirect a form it is halfway through.
 *
 * Returns the refusal to hand straight back to the caller, or null when the
 * operator is allowed. Two lines at the top of an action:
 *
 *     const refused = await refuse("posts.write");
 *     if (refused) return refused;
 *
 * Every action needs its own check. The browser hiding a button is a courtesy;
 * a server action is a public endpoint with a URL, and the only thing standing
 * between a demoted operator and a published post is this call.
 */
export async function refuse(
  permission: Permission,
): Promise<{ ok: false; message: string } | null> {
  const session = await getSession();
  if (!session) return { ok: false, message: "Your session has expired. Sign in again." };
  if (!can(session.access, permission)) {
    return { ok: false, message: "Your role does not allow that." };
  }
  return null;
}
