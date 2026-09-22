/**
 * The conversations the console holds: what arrived, what was answered.
 *
 * The public surface of the feature. Server code — a page, a layout, a route
 * handler — imports from here and never from a file inside. Client components
 * must not, because this barrel reaches the database; they import
 * `@/features/inbox/model`, which is the same vocabulary with nothing behind
 * it.
 *
 * The inbox page is not here: a route reaches it by its own path, so that a
 * server component never sits behind a door a client component may open.
 */

export { inboxChanged } from "./events";
export { countUnread } from "./queries";
export { recordInbound } from "./store";
