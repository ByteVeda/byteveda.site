"use client";

import type { MailWorkspace } from "@byteveda/db/constants";
import { createContext, useContext } from "react";
import {
  type AccessSnapshot,
  can as canDo,
  canReadWorkspace as canReadMail,
  type Permission,
} from "@/features/auth/model";

/**
 * What the signed-in operator may do, for the parts of the console that run in
 * the browser.
 *
 * Resolved once by the dashboard layout and handed down, rather than asked for
 * again here: the answer depends on a hardcoded list and a database row, and a
 * client component can see neither. What it gets is the snapshot the server
 * computed, which is the same object `requirePermission` and every server
 * action check against.
 *
 * This is presentation only. A hidden button is a courtesy — the enforcement is
 * in the action, and every action does its own check. Nothing here is load
 * bearing, and it must not be: the snapshot travels in the RSC payload, where
 * anybody who cares can read and re-send it.
 */

const AccessContext = createContext<AccessSnapshot | null>(null);

export function AccessProvider({
  access,
  children,
}: {
  access: AccessSnapshot;
  children: React.ReactNode;
}) {
  return <AccessContext.Provider value={access}>{children}</AccessContext.Provider>;
}

export function useAccess(): AccessSnapshot {
  const access = useContext(AccessContext);
  if (!access) {
    throw new Error("useAccess is only usable under the dashboard layout's AccessProvider.");
  }
  return access;
}

/** `const can = useCan(); can("mail.send")` — the common case, read as a sentence. */
export function useCan(): (permission: Permission) => boolean {
  const access = useAccess();
  return (permission) => canDo(access, permission);
}

export function useCanReadWorkspace(): (workspace: MailWorkspace) => boolean {
  const access = useAccess();
  return (workspace) => canReadMail(access, workspace);
}
