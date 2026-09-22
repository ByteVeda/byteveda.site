/**
 * A sample request, priced and checked before anything is sent, then filed.
 *
 * The public surface of the feature: the POST route imports from here and never
 * from a file inside. `service.ts` is the orchestration — the one-free-sample
 * rule, and the claim-then-send ordering that enforces it across Postgres and
 * Resend. `templates.ts` turns an `OrderLine` into the two messages it sends and
 * reaches nothing outside this process. Client components import
 * `@/features/orders/model`, which is the same rules with nothing behind them —
 * the request page itself lives in `features/sample`.
 */

export { type OrderLine, type ResolvedOrder, validateOrder } from "./model";
export { submitOrder } from "./service";
