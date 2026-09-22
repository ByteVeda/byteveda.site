/**
 * How the console is configured: whether it takes signups, and who it sends as.
 *
 * The public surface of the feature. Server code — the settings page, a
 * broadcast, a subscription — imports from here and never from a file inside.
 * Client components must not, because this barrel reaches the database; they
 * import `@/features/settings/model` for what the settings are and
 * `@/features/settings/actions` for the one write.
 *
 * The settings page is not here: a route reaches it by its own path, so that a
 * server component never sits behind a door a client component may open.
 */

export { getSettings } from "./queries";
