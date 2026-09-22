/**
 * Who may sign in, and what they may do once they have.
 *
 * The public surface of the feature: server code — a page, a route handler, a
 * server action — imports from here and never from a file inside. Client
 * components must not, because this barrel reaches the database; they import
 * `@/features/auth/model`, which is the same rules with nothing behind them.
 */

export { isSuperAdminId, superAdmins } from "./allowlist";
export { LoginPage } from "./components";
export {
  type AccessSnapshot,
  accessFor,
  basePermissionsFor,
  can,
  canReadWorkspace,
  hasOverrides,
  PERMISSIONS,
  type Permission,
  permissionsFor,
  RESERVED_PERMISSIONS,
  readableWorkspaces,
  roleLabel,
  SESSION_COOKIE,
  type SessionContext,
  STATE_COOKIE,
  sanitisePermissions,
} from "./model";
export { getSession } from "./queries";
export { refuse, requirePermission, requireSession } from "./service";
export { safeEqual, sessionCookieOptions } from "./session";
export { createSession, revokeSessionsFor } from "./store";
export { callbackUrl, originOf, safeNext } from "./urls";
