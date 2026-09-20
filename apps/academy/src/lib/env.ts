/**
 * Environment access, read lazily.
 *
 * Every value is fetched at call time rather than at module load, so importing
 * the order route on a machine with no credentials cannot fail a build — only
 * actually placing an order does.
 */

import { MAIN_DOMAIN } from "@byteveda/utils";
import { site } from "@/lib/site";

export function optional(name: string): string | undefined {
  return process.env[name] || undefined;
}

/** True when the variables a feature needs are all present. */
export function configured(...names: string[]): boolean {
  return names.every((name) => Boolean(process.env[name]));
}

export const env = {
  /** Sender for order mail. Must be an address on a domain verified in Resend. */
  orderFrom: () => optional("ACADEMY_ORDER_FROM") ?? `${site.name} <academy@${MAIN_DOMAIN}>`,
  /** Where the work order lands. */
  orderInbox: () => optional("ACADEMY_ORDER_INBOX") ?? site.contactEmail,
};
