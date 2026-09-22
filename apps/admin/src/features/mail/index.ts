/**
 * Mail: who may read a conversation, what the console sends, what arrives.
 *
 * The public surface of the feature. Server code imports from here and never
 * from a file inside; `model.ts` is the client-safe half, for anything that has
 * to run in the browser.
 */

export {
  announcementEmail,
  bodyMissing,
  broadcastEmail,
  composedEmail,
  confirmationEmail,
  type InboundEvent,
  type InboundRow,
  inboundRow,
  isMailWorkspace,
  missing,
  normaliseEmail,
  replyEmail,
  replyTargetOf,
  requires,
  threadKeyFor,
  type Verdict,
  workspaceOf,
} from "./model";
export { reachThread } from "./queries";
export { fetchInboundBody, sendEmail, sendMany } from "./service";
export { verifySignature } from "./webhook";
