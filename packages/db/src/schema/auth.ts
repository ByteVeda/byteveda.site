import { relations } from "drizzle-orm";
import { bigint, index, inet, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

/**
 * Everyone allowed into the admin app. Rows are created on first successful
 * login, never by hand — the allowlist itself lives in `ADMIN_GITHUB_IDS`, so a
 * row here is a record of someone who got in, not a grant of access.
 */
export const adminUsers = pgTable("admin_users", {
  id: uuid("id").primaryKey().defaultRandom(),
  /** GitHub's numeric user ID. Logins can be renamed and re-registered; this cannot. */
  githubId: bigint("github_id", { mode: "number" }).notNull().unique(),
  login: text("login").notNull(),
  name: text("name"),
  email: text("email"),
  avatarUrl: text("avatar_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
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

export const adminUsersRelations = relations(adminUsers, ({ many }) => ({
  sessions: many(sessions),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(adminUsers, { fields: [sessions.userId], references: [adminUsers.id] }),
}));

export type AdminUser = typeof adminUsers.$inferSelect;
export type NewAdminUser = typeof adminUsers.$inferInsert;
export type Session = typeof sessions.$inferSelect;
