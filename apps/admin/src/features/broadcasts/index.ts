/**
 * What the console mails to the whole list: drafts, sends, announcements.
 *
 * The public surface of the feature. Server code — the subscribers page that
 * hosts the composer, the publish action that announces a post — imports from
 * here and never from a file inside. Client components must not, because this
 * barrel reaches the database; they import `@/features/broadcasts/actions` for
 * the writes.
 *
 * The composer is exported straight from its file rather than through a
 * `components/` barrel, because the only thing that renders it is the
 * subscribers page, which is a server component and comes in this way.
 */

export { listBroadcasts } from "./actions";
export { BroadcastComposer } from "./components/broadcast-composer";
export { announcePost } from "./service";
