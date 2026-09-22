/**
 * What the console mails to the whole list: drafts, sends, announcements.
 *
 * The public surface of the feature. Server code — the subscribers page that
 * hosts the composer, the publish action that announces a post — imports from
 * here and never from a file inside. Client components must not, because this
 * barrel reaches the database; they import `@/features/broadcasts/actions` for
 * the writes.
 *
 * The composer is not here. It is a client component, and the subscribers page
 * that renders it reaches it through `./components` — the door that carries no
 * database behind it.
 */

export { listBroadcasts } from "./actions";
export { announcePost } from "./service";
