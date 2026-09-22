import { emailThreads, getDb } from "@byteveda/db";
import { eq } from "drizzle-orm";
import { type AccessSnapshot, canReadWorkspace, type Permission } from "@/features/auth";
import { ALLOWED, missing, requires, type Verdict } from "./model";

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
