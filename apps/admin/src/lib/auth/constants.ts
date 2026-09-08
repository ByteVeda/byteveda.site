/**
 * Cookie names, kept free of imports.
 *
 * The proxy runs on the edge runtime, where `pg` and `node:crypto` do not
 * exist. Pulling these from `session.ts` would drag both in.
 */
export const SESSION_COOKIE = "bv_admin_session";
export const STATE_COOKIE = "bv_oauth_state";
