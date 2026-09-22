/**
 * The home page is six sections inside one SDK provider, and nothing on the
 * server, so the components barrel is the feature's only door. `reveal` and the
 * `useSdk` hook are private to the sections that use them.
 */

export { Cta } from "./cta";
export { Hero } from "./hero";
export { Interop } from "./interop";
export { Lab } from "./lab";
export { Ledger } from "./ledger";
export { SdkProvider } from "./sdk-context";
export { Source } from "./source";
