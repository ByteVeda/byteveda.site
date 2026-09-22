/**
 * The conversations the console holds: what arrived, what was answered.
 *
 * The public surface of the feature. Server code — a page, a layout, a route
 * handler — imports from here and never from a file inside. Client components
 * must not, because this barrel reaches the database; they import
 * `@/features/inbox/model`, which is the same vocabulary with nothing behind
 * it.
 */

export { InboxPage } from "./components";
export { countUnread } from "./queries";
export { recordInbound } from "./store";
