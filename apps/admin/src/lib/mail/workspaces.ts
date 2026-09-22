import { MAIL_WORKSPACE_LABELS, MAIL_WORKSPACES, type MailWorkspace } from "@byteveda/db/constants";

export type { MailWorkspace };
export { MAIL_WORKSPACE_LABELS, MAIL_WORKSPACES };

/**
 * Which business a piece of mail belongs to.
 *
 * One Resend account, one inbound webhook, two businesses. A reader asking
 * about FlexiQ and a parent asking about a worksheet arrive through the same
 * hole in the wall, and the only thing that separates them is the address they
 * wrote to — so that address is where the answer comes from.
 *
 * The classification lives here and nowhere else. The column on
 * `email_threads` is written from this function, the migration that backfilled
 * it says so in a comment, and every query filters on the column rather than
 * re-deciding. Two copies of a rule like this drift, and the drift shows up as
 * mail that is invisible to the person who is supposed to answer it.
 */

/**
 * Local parts that belong to the academy, whatever domain they are on.
 *
 * `academy@` is the sender on order mail (see `apps/academy/src/lib/env.ts`),
 * and `orders@` is where the work orders land. The other two are named now so
 * that turning them on at Resend is a DNS change rather than a deploy.
 */
const ACADEMY_MAILBOXES = new Set(["academy", "orders", "samples", "admissions"]);

/** Any subdomain of the academy's own domain, e.g. `hello@academy.byteveda.org`. */
const ACADEMY_DOMAIN_PREFIX = "academy.";

export function isMailWorkspace(value: string | undefined | null): value is MailWorkspace {
  return MAIL_WORKSPACES.includes(value as MailWorkspace);
}

/** Whether one address belongs to the academy. */
function academyAddress(value: string): boolean {
  const address = value.trim().toLowerCase();
  const at = address.lastIndexOf("@");

  const local = at === -1 ? address : address.slice(0, at);
  const domain = at === -1 ? "" : address.slice(at + 1);

  // A `+tag` suffix is the sender's, not ours: `orders+urgent@` is still orders.
  const base = local.split("+")[0];

  return ACADEMY_MAILBOXES.has(base) || domain.startsWith(ACADEMY_DOMAIN_PREFIX);
}

/**
 * Which business a message belongs to.
 *
 * The address it arrived at is the main signal, and `sender` is the second one
 * — because a good deal of the academy's mail arrives from itself. Every sample
 * request sends a work order *from* `academy@byteveda.org` to whatever
 * `ACADEMY_ORDER_INBOX` names, and that defaults to `support@byteveda.org`. On
 * the to-address alone, every order in the order book would file under
 * ByteVeda, which is exactly the pile this feature exists to split.
 *
 * Fixing it at the routing end — pointing the academy at `orders@` — is the
 * tidier answer and is still worth doing. This makes the console right about
 * the mail it already has either way.
 */
export function workspaceOf(mailbox: string, sender = ""): MailWorkspace {
  if (academyAddress(mailbox)) return "academy";
  if (sender && academyAddress(sender)) return "academy";
  return "byteveda";
}

export function workspaceLabel(workspace: MailWorkspace): string {
  return MAIL_WORKSPACE_LABELS[workspace];
}
