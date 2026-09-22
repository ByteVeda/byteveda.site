/**
 * The shop's one set of numbers.
 *
 * The public surface of the feature: the catalogue, the quote engine, the site
 * description and the two marketing sections all price from here and never from
 * a file inside. Client components import `@/features/pricing/model`, which is
 * this same price list with no door in front of it.
 */

export { MIX, MIX_LABEL, MIX_TOTAL, PRICING, SETS } from "./model";
