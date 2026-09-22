import { relations } from "drizzle-orm";
import { bigint, index, inet, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import {
  ADMIN_PERMISSIONS,
  ADMIN_ROLES,
  ADMIN_STATUSES,
  type AdminPermission,
  type AdminRole,
  type AdminStatus,
  MAIL_WORKSPACES,
  type MailWorkspace,
} from "../constants";

export type { AdminPermission, AdminRole, AdminStatus };
export { ADMIN_PERMISSIONS, ADMIN_ROLES, ADMIN_STATUSES };

/** Real Postgres enums, so the closed set is the column's type. */
export const adminRole = pgEnum("admin_role", ADMIN_ROLES);
export const adminStatus = pgEnum("admin_status", ADMIN_STATUSES);
export const adminPermission = pgEnum("admin_permission", ADMIN_PERMISSIONS);
export const mailWorkspace = pgEnum("mail_workspace", MAIL_WORKSPACES);

/**
 * A role a super admin wrote, rather than one the source ships.
 *
 * The four built-in roles are jobs — editor, support — and they are in the
 * code because they are claims about what the code allows. This table is for
 * the shape that does not have a name yet: "everything support can do, plus
 * publishing", asked for once, on a Tuesday. Inventing a role in the source
 * for it would mean a deploy; inventing one here means a row.
 *
 * What it can hold is still bounded. `permissions` is an array of the
 * `admin_permission` enum, so nothing outside the catalogue in `constants.ts`
 * can be stored at all — a custom role can only ever recombine grants the
 * application already knows how to enforce. It cannot mint a new power, and it
 * cannot carry `members.manage` either: that check is a super admin's, and
 * `sanitisePermissions` in the admin app strips it on the way in.
 *
 * Scope is deliberately not here. Which inboxes somebody may read stays on
 * their own row — a role says *what*, a scope says *where*, and folding them
 * together would need a role per combination, which is the thing this exists
 * to avoid.
 */
export const adminCustomRoles = pgTable("admin_custom_roles", {
  id: uuid("id").primaryKey().defaultRandom(),
  /** Slug derived from the label. Stable across renames, and what a log reads. */
  key: text("key").notNull().unique(),
  label: text("label").notNull(),
  /** What this role is for, in the words of whoever made it. */
  description: text("description"),
  permissions: adminPermission("permissions")
    .array()
    .notNull()
    .$type<AdminPermission[]>()
    .default([]),
  /** Who made it. A plain id, like `invited_by` — deleting them keeps the role. */
  createdBy: uuid("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Everyone who may use the admin app, and what they may do in it.
 *
 * This table used to be a log: a row appeared on first successful login, and
 * the grant itself lived in `ADMIN_GITHUB_IDS` so that no write to the database
 * could widen access. That is still true of the part that matters — the super
 * admins are a hardcoded list in the application and cannot be edited from
 * inside it — but everybody else is now a row here, written by a super admin
 * before they have ever signed in. Otherwise "give this person access to the
 * academy mail" means a deploy, and a console nobody can be added to is a
 * console with one operator.
 *
 * A row is therefore a grant. `status` is how one is taken back without losing
 * the record of who had it, and deleting the row is how it is erased.
 */
export const adminUsers = pgTable("admin_users", {
  id: uuid("id").primaryKey().defaultRandom(),
  /** GitHub's numeric user ID. Logins can be renamed and re-registered; this cannot. */
  githubId: bigint("github_id", { mode: "number" }).notNull().unique(),
  login: text("login").notNull(),
  name: text("name"),
  email: text("email"),
  avatarUrl: text("avatar_url"),
  /**
   * What they may do. Which permissions the role carries is decided in
   * `apps/admin/src/lib/auth/roles.ts`, not here — a permission is a claim
   * about what the code allows, and only the code can keep it honest.
   */
  role: adminRole("role").notNull().default("viewer"),
  /**
   * A role a super admin wrote, which replaces `role` when it is set.
   *
   * `role` is kept rather than cleared, and that is what makes deleting a
   * custom role safe: the foreign key nulls this column, and the member lands
   * back on the built-in role they were on before. A grant that evaporated
   * with the role would be a way to lock the console's last editor out by
   * tidying up.
   */
  customRoleId: uuid("custom_role_id").references(() => adminCustomRoles.id, {
    onDelete: "set null",
  }),
  /**
   * One person's exceptions to whichever role they are on.
   *
   * The reason a console this size does not need twelve roles. "Support, but
   * they also publish the release notes" is one permission in `extra`, not a
   * role nobody else will ever hold; "editor, but not this quarter's launch
   * posts" is one in `denied`. Both are computed against the role rather than
   * replacing it, so changing the role still changes what they can do.
   *
   * Denied wins over extra and over the role — the only ordering that makes
   * "take this away" mean it, whatever else is ticked.
   */
  extraPermissions: adminPermission("extra_permissions")
    .array()
    .notNull()
    .$type<AdminPermission[]>()
    .default([]),
  deniedPermissions: adminPermission("denied_permissions")
    .array()
    .notNull()
    .$type<AdminPermission[]>()
    .default([]),
  status: adminStatus("status").notNull().default("active"),
  /**
   * Which mail they may read, independent of the role.
   *
   * Orthogonal on purpose: "admin, academy mail only" and "support, both
   * inboxes" are both real, and folding the two axes into one role list would
   * need a role per combination. Empty means no mail at all; a super admin
   * ignores this column entirely.
   */
  mailWorkspaces: mailWorkspace("mail_workspaces")
    .array()
    .notNull()
    .$type<MailWorkspace[]>()
    .default([]),
  /** Who let them in. Null for a super admin, or for a row that predates this. */
  invitedBy: uuid("invited_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  /** Null until they first sign in, which is what makes a row read as "invited". */
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
});

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => adminUsers.id, { onDelete: "cascade" }),
    /**
     * SHA-256 of the cookie token, never the token. A dump of this table is not
     * a set of working sessions.
     */
    tokenHash: text("token_hash").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
    ip: inet("ip"),
    userAgent: text("user_agent"),
  },
  (table) => [
    index("sessions_user_id_idx").on(table.userId),
    // Swept by the expiry job; without this it is a sequential scan of every session.
    index("sessions_expires_at_idx").on(table.expiresAt),
  ],
);

export const adminUsersRelations = relations(adminUsers, ({ many, one }) => ({
  sessions: many(sessions),
  customRole: one(adminCustomRoles, {
    fields: [adminUsers.customRoleId],
    references: [adminCustomRoles.id],
  }),
}));

export const adminCustomRolesRelations = relations(adminCustomRoles, ({ many }) => ({
  members: many(adminUsers),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(adminUsers, { fields: [sessions.userId], references: [adminUsers.id] }),
}));

export type AdminUser = typeof adminUsers.$inferSelect;
export type NewAdminUser = typeof adminUsers.$inferInsert;
export type AdminCustomRole = typeof adminCustomRoles.$inferSelect;
export type NewAdminCustomRole = typeof adminCustomRoles.$inferInsert;
export type Session = typeof sessions.$inferSelect;
