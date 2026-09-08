import { relations, sql } from "drizzle-orm";
import {
  bigint,
  check,
  date,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { ECOSYSTEM_LABELS, ECOSYSTEMS, type Ecosystem } from "../constants";

export type { Ecosystem };
/**
 * Where a package is published. One row per package per ecosystem, never per
 * upstream API — pypistats and pepy.tech both describe PyPI, and counting them
 * as two sources would double every Python number.
 *
 * The values live in `constants.ts` so the stats page's dropdown can read them
 * without pulling in the ORM.
 */
export { ECOSYSTEM_LABELS, ECOSYSTEMS };

export const projectPackages = pgTable(
  "project_packages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Matches a slug in the catalogue in @byteveda/utils. */
    projectSlug: text("project_slug").notNull(),
    ecosystem: text("ecosystem").$type<Ecosystem>().notNull(),
    /** `flexiq`, `@byteveda/flexiq`, `org.byteveda.agenteval:agenteval-junit5`. */
    packageName: text("package_name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("project_packages_ecosystem_name_idx").on(table.ecosystem, table.packageName),
    index("project_packages_project_idx").on(table.projectSlug),
    check(
      "project_packages_ecosystem_check",
      sql.raw(`"ecosystem" in (${ECOSYSTEMS.map((value) => `'${value}'`).join(", ")})`),
    ),
  ],
);

/**
 * One row per package per day.
 *
 * The unique constraint is what makes the collector idempotent: re-running it
 * for a day already recorded overwrites that day rather than adding to it, so a
 * retry, an overlapping cron, and a backfill are all safe.
 */
export const downloadSnapshots = pgTable(
  "download_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    packageId: uuid("package_id")
      .notNull()
      .references(() => projectPackages.id, { onDelete: "cascade" }),
    day: date("day").notNull(),
    downloads: bigint("downloads", { mode: "number" }).notNull(),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("download_snapshots_package_day_idx").on(table.packageId, table.day),
    // Charts read a window per package, newest first.
    index("download_snapshots_day_idx").on(table.day),
    check("download_snapshots_downloads_check", sql`"downloads" >= 0`),
  ],
);

/**
 * Lifetime totals, for the registries that publish a running count but no
 * history. Separate from the daily table so a total is never mistaken for a
 * day's traffic, and vice versa.
 */
export const packageTotals = pgTable("package_totals", {
  packageId: uuid("package_id")
    .primaryKey()
    .references(() => projectPackages.id, { onDelete: "cascade" }),
  total: bigint("total", { mode: "number" }).notNull(),
  /** Which upstream produced the number, for provenance. */
  source: text("source").notNull(),
  fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Whether the last collection worked, so a silent failure is visible. */
export const collectionRuns = pgTable(
  "collection_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    packageId: uuid("package_id").references(() => projectPackages.id, { onDelete: "cascade" }),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    ok: text("ok").$type<"ok" | "failed" | "unsupported">().notNull(),
    detail: text("detail"),
    daysWritten: bigint("days_written", { mode: "number" }).notNull().default(0),
  },
  (table) => [index("collection_runs_started_idx").on(table.startedAt)],
);

export const projectPackagesRelations = relations(projectPackages, ({ many, one }) => ({
  snapshots: many(downloadSnapshots),
  total: one(packageTotals),
}));

export const downloadSnapshotsRelations = relations(downloadSnapshots, ({ one }) => ({
  package: one(projectPackages, {
    fields: [downloadSnapshots.packageId],
    references: [projectPackages.id],
  }),
}));

export type ProjectPackage = typeof projectPackages.$inferSelect;
export type DownloadSnapshot = typeof downloadSnapshots.$inferSelect;
export type PackageTotal = typeof packageTotals.$inferSelect;
