/**
 * The simulation runs in the browser, so the playground has no server API and
 * this barrel is its only door. What is on it is what the home page's failure
 * lab borrows: the engine hook and the two views it feeds. `playground` itself
 * is not — the playground route reaches its own screen by that file's path.
 */

export { Stage } from "./canvas/stage";
export { EventLog } from "./event-log";
export { useEngine } from "./use-engine";
