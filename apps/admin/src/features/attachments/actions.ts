"use server";

import { getSession } from "@/features/auth";
import { parseScope } from "./model";
import { authoriseScope } from "./queries";
import { discard } from "./store";

export type AttachmentResult = { ok: boolean; message: string };

/**
 * Takes a file back out of a composer before it is sent.
 *
 * An action rather than a `DELETE` route: there is no body worth streaming, and
 * an action is already authenticated, already CSRF-checked by Next, and already
 * what every other mutation in the console uses.
 *
 * The composer is named as well as the file, and `discard` requires both to
 * match — so an id belonging to somebody else's draft cannot be removed by
 * guessing it, and one that has already gone out cannot be removed at all.
 */
export async function removeAttachment(
  kind: string,
  owner: string,
  id: string,
): Promise<AttachmentResult> {
  const session = await getSession();
  if (!session) return { ok: false, message: "Your session has expired. Sign in again." };

  const scope = parseScope(kind, owner);
  if (!scope) return { ok: false, message: "Nothing to remove it from." };

  const allowed = await authoriseScope(scope, session.access);
  if (!allowed.ok) return { ok: false, message: allowed.message };

  const removed = await discard(scope, id);
  return removed
    ? { ok: true, message: "Removed." }
    : { ok: false, message: "That file is no longer attached." };
}
