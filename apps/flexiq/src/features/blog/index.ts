/**
 * The blog's server API. Every reader on it is a cached, tag-invalidated read of
 * the posts the admin console publishes, so the whole feature is server-only and
 * this barrel is its one door.
 */

export { formatDate, getPost, getPosts, getStaticSlugs } from "./queries";
