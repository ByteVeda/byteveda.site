/**
 * The per-file ceiling this deployment is actually running under.
 *
 * Apart from `model.ts` because it reads the environment, and `model.ts` is
 * what a client component imports — the same reason `features/auth` keeps
 * `allowlist.ts` apart from its model. `process.env` is not there in the
 * browser, so a browser asking this question would only ever be told the
 * default; the default is a constant in `model.ts` instead, and this is the
 * server's answer.
 */

import { DEFAULT_MAX_ATTACHMENT_BYTES, RESEND_MAX_EMAIL_BYTES } from "./model";

/**
 * What one upload request may carry.
 *
 * Not Resend's limit — the platform's. A serverless function on Vercel rejects
 * a request body over 4.5MB before any of this code runs, with a 413 the
 * browser reports as a network error. So a file arrives on its own, one per
 * request, and a 40MB email is assembled from several of them.
 *
 * `ADMIN_MAX_ATTACHMENT_BYTES` raises it for a deployment that is not behind
 * that limit — a container, or a self-hosted Node server.
 */
export function maxFileBytes(): number {
  const configured = Number(process.env.ADMIN_MAX_ATTACHMENT_BYTES);
  if (Number.isInteger(configured) && configured > 0) {
    return Math.min(configured, RESEND_MAX_EMAIL_BYTES);
  }
  return DEFAULT_MAX_ATTACHMENT_BYTES;
}
