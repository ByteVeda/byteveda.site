/**
 * The writing the console publishes: drafts, revisions, what went live.
 *
 * The public surface of the feature. Server code — a page, a route handler,
 * another feature's view — imports from here and never from a file inside.
 * Client components must not, because this barrel reaches the database; they
 * import `@/features/posts/model` for the rules and `@/features/posts/actions`
 * for the writes.
 *
 * The two page components are exported straight from their files rather than
 * through `components/`, which would put a server component behind the door a
 * client component is allowed to open.
 */

export { EditPostPage, generateMetadata } from "./components/post-editor-page";
export { PostsPage } from "./components/posts-page";
export { countPostsByStatus, listPosts } from "./queries";
