import {
  collectionRuns,
  downloadSnapshots,
  getDb,
  packageTotals,
  projectPackages,
} from "@byteveda/db";
import { projects } from "@byteveda/utils";
import { desc, gte } from "drizzle-orm";
import { daysAgo } from "@/lib/registries/http";
import { type DailyTotal, type PackageStats, type ProjectStats, WINDOW_DAYS } from "./model";

const HISTORY_DAYS = WINDOW_DAYS * 2;

function emptyDays(count: number, endingToday = new Date()): string[] {
  return Array.from({ length: count }, (_, index) =>
    new Date(endingToday.getTime() - (count - 1 - index) * 86_400_000).toISOString().slice(0, 10),
  );
}

/**
 * Everything the dashboard renders, assembled from four small queries.
 *
 * Joining and aggregating this in SQL would be one clever statement; with a
 * dozen packages and sixty days it is a few hundred rows, and doing the shaping
 * in TypeScript keeps it readable and testable.
 */
export async function getStatsOverview(): Promise<{
  projects: ProjectStats[];
  /** All packages summed per day — the headline series. */
  daily: DailyTotal[];
  last30: number;
  previous30: number;
  lastRunAt: Date | null;
  packageCount: number;
}> {
  const db = getDb();

  const [packages, snapshots, totals, runs] = await Promise.all([
    db.select().from(projectPackages).orderBy(projectPackages.ecosystem),
    db
      .select()
      .from(downloadSnapshots)
      .where(gte(downloadSnapshots.day, daysAgo(HISTORY_DAYS - 1))),
    db.select().from(packageTotals),
    db.select().from(collectionRuns).orderBy(desc(collectionRuns.startedAt)).limit(200),
  ]);

  const byPackage = new Map<string, Map<string, number>>();
  for (const row of snapshots) {
    const days = byPackage.get(row.packageId) ?? new Map<string, number>();
    days.set(row.day, row.downloads);
    byPackage.set(row.packageId, days);
  }

  const totalFor = new Map(totals.map((row) => [row.packageId, row]));

  // Runs come back newest first, so the first one seen per package is its latest.
  const latestRun = new Map<string, (typeof runs)[number]>();
  for (const run of runs) {
    if (run.packageId && !latestRun.has(run.packageId)) latestRun.set(run.packageId, run);
  }

  const window = emptyDays(HISTORY_DAYS);
  const recent = window.slice(WINDOW_DAYS);
  const earlier = window.slice(0, WINDOW_DAYS);

  const statsByProject = new Map<string, PackageStats[]>();

  for (const pkg of packages) {
    const days = byPackage.get(pkg.id) ?? new Map<string, number>();
    const sum = (range: string[]) => range.reduce((total, day) => total + (days.get(day) ?? 0), 0);
    const run = latestRun.get(pkg.id);
    const total = totalFor.get(pkg.id);

    const entry: PackageStats = {
      packageId: pkg.id,
      ecosystem: pkg.ecosystem,
      packageName: pkg.packageName,
      spark: recent.map((day) => days.get(day) ?? null),
      recordedDays: recent.filter((day) => days.has(day)).length,
      last30: sum(recent),
      previous30: sum(earlier),
      total: total?.total ?? null,
      totalSource: total?.source ?? null,
      status: run?.ok ?? "never",
      detail: run?.detail ?? null,
      lastRunAt: run?.startedAt ?? null,
    };

    statsByProject.set(pkg.projectSlug, [...(statsByProject.get(pkg.projectSlug) ?? []), entry]);
  }

  const named = new Map(projects.map((project) => [project.slug, project.name]));

  const shaped: ProjectStats[] = [...statsByProject.entries()]
    .map(([slug, entries]) => ({
      slug,
      name: named.get(slug) ?? slug,
      packages: entries,
      last30: entries.reduce((total, entry) => total + entry.last30, 0),
      previous30: entries.reduce((total, entry) => total + entry.previous30, 0),
    }))
    .sort((a, b) => b.last30 - a.last30 || a.name.localeCompare(b.name));

  // Summed across every package. A day nobody recorded stays null so the chart
  // breaks the line there instead of drawing a drop to zero.
  const recordedDays = new Set(snapshots.map((row) => row.day));
  const totalPerDay = new Map<string, number>();
  for (const row of snapshots) {
    totalPerDay.set(row.day, (totalPerDay.get(row.day) ?? 0) + row.downloads);
  }

  const daily: DailyTotal[] = recent.map((day) => ({
    day,
    downloads: recordedDays.has(day) ? (totalPerDay.get(day) ?? 0) : null,
  }));

  return {
    projects: shaped,
    daily,
    last30: shaped.reduce((total, project) => total + project.last30, 0),
    previous30: shaped.reduce((total, project) => total + project.previous30, 0),
    lastRunAt: runs[0]?.startedAt ?? null,
    packageCount: packages.length,
  };
}
