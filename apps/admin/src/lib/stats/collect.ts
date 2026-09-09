import {
  collectionRuns,
  downloadSnapshots,
  getDb,
  type ProjectPackage,
  packageTotals,
  projectPackages,
} from "@byteveda/db";
import { sql } from "drizzle-orm";
import { adapterFor } from "./sources";
import type { DailyPoint } from "./types";

export type PackageOutcome = {
  packageId: string;
  ecosystem: ProjectPackage["ecosystem"];
  packageName: string;
  status: "ok" | "failed" | "unsupported";
  detail: string;
  daysWritten: number;
};

/** Postgres caps a statement's parameters; daily rows go in manageable batches. */
const BATCH = 500;

/**
 * Writes a package's daily rows.
 *
 * Upsert on (package, day) is what makes the whole job idempotent: re-running
 * for a day already recorded replaces it, so a retried cron, an overlapping
 * run, and a backfill over live data all converge on the same table.
 */
async function writeDaily(packageId: string, daily: DailyPoint[]): Promise<number> {
  if (daily.length === 0) return 0;
  const db = getDb();

  for (let start = 0; start < daily.length; start += BATCH) {
    const rows = daily.slice(start, start + BATCH).map((point) => ({
      packageId,
      day: point.day,
      downloads: point.downloads,
      fetchedAt: new Date(),
    }));

    await db
      .insert(downloadSnapshots)
      .values(rows)
      .onConflictDoUpdate({
        target: [downloadSnapshots.packageId, downloadSnapshots.day],
        // `excluded` is the row the insert would have added — the freshly
        // fetched number wins over whatever was recorded for that day before.
        set: { downloads: sql`excluded.downloads`, fetchedAt: new Date() },
      });
  }

  return daily.length;
}

/** Collects one package. Never throws — a bad registry is a recorded outcome. */
export async function collectPackage(pkg: ProjectPackage): Promise<PackageOutcome> {
  const db = getDb();
  const base = {
    packageId: pkg.id,
    ecosystem: pkg.ecosystem,
    packageName: pkg.packageName,
  };

  let result: Awaited<ReturnType<ReturnType<typeof adapterFor>["fetch"]>>;
  try {
    result = await adapterFor(pkg.ecosystem).fetch(pkg.packageName);
  } catch (error) {
    result = {
      kind: "failed",
      detail: error instanceof Error ? error.message : "Unknown error.",
    };
  }

  if (result.kind !== "ok") {
    await db.insert(collectionRuns).values({
      packageId: pkg.id,
      ok: result.kind === "unsupported" ? "unsupported" : "failed",
      detail: result.detail,
    });
    return { ...base, status: result.kind, detail: result.detail, daysWritten: 0 };
  }

  const daysWritten = await writeDaily(pkg.id, result.daily);

  if (result.total) {
    await db
      .insert(packageTotals)
      .values({
        packageId: pkg.id,
        total: result.total.value,
        source: result.total.source,
        fetchedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: packageTotals.packageId,
        set: { total: result.total.value, source: result.total.source, fetchedAt: new Date() },
      });
  }

  await db.insert(collectionRuns).values({ packageId: pkg.id, ok: "ok", daysWritten });

  return {
    ...base,
    status: "ok",
    detail: `${daysWritten} day${daysWritten === 1 ? "" : "s"} recorded.`,
    daysWritten,
  };
}

/**
 * Collects everything, one package at a time.
 *
 * Sequential on purpose: five registries do not need parallelism, and hitting
 * them in a burst is the fastest way to earn a 429.
 */
export async function collectAll(): Promise<PackageOutcome[]> {
  const packages = await getDb().select().from(projectPackages).orderBy(projectPackages.ecosystem);

  const outcomes: PackageOutcome[] = [];
  for (const pkg of packages) {
    outcomes.push(await collectPackage(pkg));
  }
  return outcomes;
}
