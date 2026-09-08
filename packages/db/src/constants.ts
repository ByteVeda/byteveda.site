/**
 * The closed sets the schema constrains, with no imports at all.
 *
 * A client component that needs to render a dropdown of registries must not
 * pull in the schema to do it — `@byteveda/db` re-exports the pooled client,
 * and importing any value from it drags `pg` into the browser bundle. This
 * module is the safe surface: import it from `@byteveda/db/constants`.
 */

export const POST_SITES = ["flexiq"] as const;
export type PostSite = (typeof POST_SITES)[number];

export const POST_STATUSES = ["draft", "published", "archived"] as const;
export type PostStatus = (typeof POST_STATUSES)[number];

export const POST_FORMATS = ["richtext", "mdx"] as const;
export type PostFormat = (typeof POST_FORMATS)[number];

export type PostSeo = {
  keywords: string[];
  metaTitle?: string;
  metaDescription?: string;
  ogImage?: string;
};

export const EMPTY_SEO: PostSeo = { keywords: [] };

export const ECOSYSTEMS = ["pypi", "npm", "crates", "maven"] as const;
export type Ecosystem = (typeof ECOSYSTEMS)[number];

export const SUBSCRIBER_STATUSES = ["pending", "active", "unsubscribed", "bounced"] as const;
export type SubscriberStatus = (typeof SUBSCRIBER_STATUSES)[number];

export const BROADCAST_STATUSES = ["draft", "sending", "sent", "failed"] as const;
export type BroadcastStatus = (typeof BROADCAST_STATUSES)[number];

/** What a sent message was for, so the log can be filtered without guessing. */
export const OUTBOUND_KINDS = [
  "transactional",
  "confirmation",
  "broadcast",
  "announcement",
  "reply",
] as const;
export type OutboundKind = (typeof OUTBOUND_KINDS)[number];

export const ECOSYSTEM_LABELS: Record<Ecosystem, string> = {
  pypi: "PyPI",
  npm: "npm",
  crates: "crates.io",
  maven: "Maven Central",
};
