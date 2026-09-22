/**
 * The mailing list, from both sides: the console's roll and the reader's
 * confirm and unsubscribe links.
 *
 * One feature rather than two, because the operator's list and the public pages
 * are the same rows, the same tokens and the same consent — splitting them
 * would put half the rules on each side of a door. The public surfaces live in
 * `components/` beside the console's page and are wired up under `app/s/`.
 *
 * The public surface of the feature. Server code — the subscribers page, the
 * public signup and subscription endpoints, a broadcast about to send —
 * imports from here and never from a file inside. Client components must not,
 * because this barrel reaches the database; they import
 * `@/features/subscribers/actions` for the writes.
 *
 * The three page components are not here: a route reaches its page by the
 * page's own path, so that a server component never sits behind a door a
 * client component may open. Two of them read `next/headers`, which is also
 * what kept this door shut to the command-line checks.
 */

export { subscribersChanged } from "./events";
export { activeSubscribers, countByStatus } from "./queries";
export { confirm, subscribe, unsubscribe, unsubscribeUrl } from "./service";
