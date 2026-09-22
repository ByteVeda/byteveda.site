import { emailThreads, getDb } from "@byteveda/db";
import { eq } from "drizzle-orm";
import { type AccessSnapshot, can, canReadWorkspace, type Permission } from "@/lib/auth/roles";

/**
 * Whether an operator may touch a particular conversation.
 *
 * Mail is the one part of the console where the permission is not the whole
 * answer: `mail.send` says somebody answers mail, and their workspaces say
 * whose. Both have to hold, and they have to hold in every path that reaches a
 * conversation — the page, the four thread actions, the reply, the attachment
 * upload and the attachment download. This is that check, once.
 *
 * A conversation in a workspace this operator cannot read answers exactly like
 * one that does not exist. The alternative confirms, to somebody trying thread
 * keys, that there is something there.
 */

export type Denial = { ok: false; status: number; message: string };
export type Allowed = { ok: true };
export type Verdict = Allowed | Denial;

export const ALLOWED: Allowed = { ok: true };

export const forbidden = (message: string): Denial => ({ ok: false, status: 403, message });
export const missing = (message: string): Denial => ({ ok: false, status: 404, message });

const REFUSALS: Record<string, string> = {
  "mail.read": "Your role does not allow reading mail.",
  "mail.send": "Your role does not allow replying to mail.",
  "mail.manage": "Your role does not allow filing or deleting mail.",
  "broadcasts.send": "Your role does not allow sending broadcasts.",
  "subscribers.read": "Your role does not allow reading the mailing list.",
};

export function requires(access: AccessSnapshot, permission: Permission): Verdict {
  if (can(access, permission)) return ALLOWED;
  return forbidden(REFUSALS[permission] ?? "Your role does not allow that.");
}

export async function reachThread(
  threadKey: string,
  access: AccessSnapshot,
  permission: Permission,
): Promise<Verdict> {
  const permitted = requires(access, permission);
  if (!permitted.ok) return permitted;

  const [thread] = await getDb()
    .select({ workspace: emailThreads.workspace })
    .from(emailThreads)
    .where(eq(emailThreads.threadKey, threadKey))
    .limit(1);

  if (!thread || !canReadWorkspace(access, thread.workspace)) {
    return missing("That conversation no longer exists.");
  }

  return ALLOWED;
}
