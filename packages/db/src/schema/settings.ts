import { jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

/**
 * Runtime configuration the operator can change without a deploy — the
 * newsletter and post-announcement toggles, and anything later that has the
 * same shape. Keys are declared in `queries/settings.ts`, which owns the
 * defaults and the types; this table only stores them.
 */
export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Setting = typeof settings.$inferSelect;
