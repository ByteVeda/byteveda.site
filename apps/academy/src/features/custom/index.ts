/**
 * The chapter we have not written yet: what a request may ask for, and what it
 * would cost.
 *
 * The public surface of the feature: the order model imports from here and
 * never from a file inside. Client components import `@/features/custom/model`,
 * and the request form itself is in `./components`.
 */

export { COPIES, type CustomRequest, describeRequest, quoteFor } from "./model";
