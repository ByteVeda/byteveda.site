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
 * A super admin may also define roles of their own, which are rows in
 * `admin_custom_roles` carrying an explicit permission list. Those cannot be
 * in this enum — it is a column's type, and a new value would mean a migration
 * per role — so a member is either on one of these four or on a custom one,
 * and `custom_role_id` is what says which.
 *
 * "Super admin" is deliberately absent from both. It is not a row anyone can be
 * given; it is a hardcoded list of GitHub IDs, and no write to this database
 * can widen it.
 */
export const ADMIN_ROLES = ["admin", "editor", "support", "viewer"] as const;
export type AdminRole = (typeof ADMIN_ROLES)[number];

/**
 * Everything the console can be asked to allow, named `resource.verb`.
 *
 * Here rather than in the admin app because the set is now a Postgres enum:
 * a custom role stores its permissions as a column, and the column's type
 * should be the closed set rather than `text[]` that any typo fits into. The
 * admin app re-exports this as `PERMISSIONS` and remains the only place that
 * decides which of them each built-in role carries.
 *
 * Groups of two or three — read, write, and the irreversible one — because
 * "may edit a post" and "may put it in front of the public" are genuinely
 * different grants, and so are "may read the mail" and "may answer it as us".
 */
export const ADMIN_PERMISSIONS = [
  "posts.read",
  "posts.write",
  "posts.publish",
  "stats.read",
  "stats.write",
  "subscribers.read",
  "subscribers.write",
  "broadcasts.send",
  "mail.read",
  "mail.send",
  "mail.manage",
  "settings.read",
  "settings.write",
  "members.read",
  "members.manage",
] as const;

export type AdminPermission = (typeof ADMIN_PERMISSIONS)[number];

/**
 * The thing a permission is about, derived from the name rather than declared.
 *
 * Deriving it means a new permission cannot be added to a resource that does
 * not exist, and cannot be forgotten by the screen that groups them.
 */
export type AdminResource = AdminPermission extends `${infer Resource}.${string}`
  ? Resource
  : never;

/** The order resources are shown in, which is roughly the order of the rail. */
export const ADMIN_RESOURCES = [
  "posts",
  "stats",
  "subscribers",
  "broadcasts",
  "mail",
  "settings",
  "members",
] as const satisfies readonly AdminResource[];

export function resourceOf(permission: AdminPermission): AdminResource {
  return permission.slice(0, permission.indexOf(".")) as AdminResource;
}

export const ADMIN_RESOURCE_LABELS: Record<AdminResource, string> = {
  posts: "Posts",
  stats: "Downloads",
  subscribers: "Subscribers",
  broadcasts: "Broadcasts",
  mail: "Inbox",
  settings: "Settings",
  members: "Members",
};

/**
 * What ticking one actually hands over, in the second person.
 *
 * Written out rather than generated from the verb: "manage" means archiving a
 * conversation in one place and editing every grant in the console in another,
 * and a screen that says "Manage" twice has told the person nothing.
 */
export const ADMIN_PERMISSION_LABELS: Record<AdminPermission, { verb: string; hint: string }> = {
  "posts.read": { verb: "Read", hint: "See every post, draft ones included." },
  "posts.write": { verb: "Write", hint: "Create and edit posts, and upload their images." },
  "posts.publish": { verb: "Publish", hint: "Put a post in front of the public, or take it down." },
  "stats.read": { verb: "Read", hint: "See download figures and the registries behind them." },
  "stats.write": { verb: "Write", hint: "Add or remove a tracked package, and force a refresh." },
  "subscribers.read": { verb: "Read", hint: "See the list and each address's state." },
  "subscribers.write": { verb: "Write", hint: "Add, edit and unsubscribe addresses." },
  "broadcasts.send": {
    verb: "Send",
    hint: "Mail the whole list. This one cannot be taken back.",
  },
  "mail.read": { verb: "Read", hint: "Open conversations in the granted inboxes." },
  "mail.send": { verb: "Send", hint: "Reply as ByteVeda, with attachments." },
  "mail.manage": { verb: "Manage", hint: "Archive, reopen and assign conversations." },
  "settings.read": { verb: "Read", hint: "See the console's configuration." },
  "settings.write": {
    verb: "Write",
    hint: "Change it, including anything integrations depend on.",
  },
  "members.read": { verb: "Read", hint: "See who has access and what it amounts to." },
  "members.manage": {
    verb: "Manage",
    hint: "Grant and withdraw access. Reserved for super admins.",
  },
};

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
