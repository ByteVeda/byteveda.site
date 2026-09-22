/**
 * The pick, and the three places it shows up.
 *
 * The whole feature is client-side — the pick lives in the tab, not on the
 * server — so this is the only door it has. `sample-page` is not on it: the
 * route reaches its own page component by that component's path.
 */

export { SampleBar } from "./sample-bar";
export { SampleButton } from "./sample-button";
export { SampleProvider, useSamples } from "./store";
