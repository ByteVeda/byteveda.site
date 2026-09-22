/**
 * How often the published packages are downloaded, and from where.
 *
 * The public surface of the feature. Server code — the nightly cron route, the
 * overview page, the command-line collector — imports from here and never from
 * a file inside. Client components must not, because this barrel reaches the
 * database; they import `@/features/stats/model` for the naming hints and the
 * shapes, and `@/features/stats/actions` for the writes.
 *
 * The downloads page is not here: a route reaches it by its own path, so that a
 * server component never sits behind a door a client component may open.
 */

export { catalogueSuggestions, WINDOW_DAYS } from "./model";
export { getStatsOverview } from "./queries";
export { collectAll } from "./service";
