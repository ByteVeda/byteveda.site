/**
 * How the console is configured: whether it takes signups, and who it sends as.
 *
 * The public surface of the feature. Server code — the settings page, a
 * broadcast, a subscription — imports from here and never from a file inside.
 * Client components must not, because this barrel reaches the database; they
 * import `@/features/settings/model` for what the settings are and
 * `@/features/settings/actions` for the one write.
 *
 * The page component is exported straight from its file rather than through
 * `components/`, which would put a server component behind the door a client
 * component is allowed to open.
 */

export { SettingsPage } from "./components/settings-page";
export { getSettings } from "./queries";
