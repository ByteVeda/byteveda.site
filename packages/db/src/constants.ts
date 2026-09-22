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

/** What a free sample was asked for: a catalogue chapter, or a described one. */
export const SAMPLE_KINDS = ["chapter", "custom"] as const;
export type SampleKind = (typeof SAMPLE_KINDS)[number];

/**
 * What a member of the console may do, as a job rather than as a checklist.
 *
 * Four roles and no more: a role people cannot name is one they assign wrongly.
 * Which permissions each one carries is decided in the application — see
 * `apps/admin/src/lib/auth/roles.ts` — because a permission is a statement
 * about the code, and the code is where it can be kept true.
 *
 * "Super admin" is deliberately absent. It is not a row anyone can be given;
 * it is a hardcoded list of GitHub IDs, and no write to this database can
 * widen it.
 */
export const ADMIN_ROLES = ["admin", "editor", "support", "viewer"] as const;
export type AdminRole = (typeof ADMIN_ROLES)[number];

/** Suspended keeps the record and the history; only signing in stops. */
export const ADMIN_STATUSES = ["active", "suspended"] as const;
export type AdminStatus = (typeof ADMIN_STATUSES)[number];

/**
 * Which business the mail belongs to.
 *
 * One Resend account and one inbound webhook carry both, so the mailbox the
 * message arrived at is the only thing that separates a reader's question about
 * FlexiQ from a parent's question about a worksheet. Stamping the conversation
 * with it makes that separation something a query can filter on and something a
 * permission can be granted against, rather than a convention in a subject line.
 */
export const MAIL_WORKSPACES = ["byteveda", "academy"] as const;
export type MailWorkspace = (typeof MAIL_WORKSPACES)[number];

export const ECOSYSTEM_LABELS: Record<Ecosystem, string> = {
  pypi: "PyPI",
  npm: "npm",
  crates: "crates.io",
  maven: "Maven Central",
};

export const ADMIN_ROLE_LABELS: Record<AdminRole, string> = {
  admin: "Admin",
  editor: "Editor",
  support: "Support",
  viewer: "Viewer",
};

export const MAIL_WORKSPACE_LABELS: Record<MailWorkspace, string> = {
  byteveda: "ByteVeda",
  academy: "Academy",
};
