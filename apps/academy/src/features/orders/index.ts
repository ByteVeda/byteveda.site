/**
 * A sample request, priced and checked before anything is sent.
 *
 * The public surface of the feature: the POST route and the Resend adapter in
 * `lib/` import from here and never from a file inside. Client components
 * import `@/features/orders/model`, which is the same rules with nothing behind
 * them — the request page itself lives in `features/sample`.
 */

export { type OrderLine, type ResolvedOrder, validateOrder } from "./model";
