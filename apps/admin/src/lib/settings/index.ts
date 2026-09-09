/**
 * Server-side entry point. A client component must import `./registry`
 * directly — this one reaches the database.
 */
export * from "./registry";
export { getSettings, setSetting } from "./store";
