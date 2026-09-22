/**
 * The writing the console publishes: drafts, revisions, what went live.
 *
 * The public surface of the feature. Server code — a page, a route handler,
 * another feature's view — imports from here and never from a file inside.
 * Client components must not, because this barrel reaches the database; they
 * import `@/features/posts/model` for the rules and `@/features/posts/actions`
 * for the writes.
 *
 * The two page components are not here: a route reaches its page by the page's
 * own path, so that a server component never sits behind a door a client
 * component may open.
 */

export { countPostsByStatus, listPosts } from "./queries";
