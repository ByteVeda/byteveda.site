import { getJson } from "../http";
import type { Adapter, DailyPoint, FetchResult, LifetimeTotal } from "../types";

/** pypistats keeps roughly 180 days, which is also the backfill window. */
type PypistatsBody = {
  data: { category: string; date: string; downloads: number }[];
};

type PepyBody = { total_downloads?: number; downloads?: Record<string, unknown> };

/**
 * Sums the rows pypistats returns per day.
 *
 * The overall endpoint reports one row per category (`with_mirrors` and
 * `without_mirrors`) per day. Asking for `mirrors=false` should leave one, but
 * summing rather than taking the first means a change upstream shows up as a
 * number that is too big rather than silently half-right.
 */
export function parsePypistats(body: PypistatsBody): DailyPoint[] {
  const byDay = new Map<string, number>();

  for (const row of body.data ?? []) {
    if (!row?.date || typeof row.downloads !== "number" || row.downloads < 0) continue;
    byDay.set(row.date, (byDay.get(row.date) ?? 0) + row.downloads);
  }

  return [...byDay.entries()]
    .map(([day, downloads]) => ({ day, downloads }))
    .sort((a, b) => a.day.localeCompare(b.day));
}

export function parsePepyTotal(body: PepyBody): LifetimeTotal | undefined {
  const total = body?.total_downloads;
  return typeof total === "number" && total >= 0
    ? { value: total, source: "pepy.tech" }
    : undefined;
}

/**
 * Lifetime total from pepy.tech, which needs an API key.
 *
 * Absent one this returns nothing and the package simply has no lifetime
 * figure — the daily series from pypistats is unaffected.
 */
async function lifetimeTotal(packageName: string): Promise<LifetimeTotal | undefined> {
  const key = process.env.PEPY_API_KEY;
  if (!key) return undefined;

  const result = await getJson<PepyBody>(
    `https://api.pepy.tech/api/v2/projects/${encodeURIComponent(packageName)}`,
    { "X-API-Key": key },
  );

  return result.ok ? parsePepyTotal(result.body) : undefined;
}

export const pypi: Adapter = {
  ecosystem: "pypi",
  label: "PyPI",
  hint: "The name you `pip install` — for example, flexiq",

  async fetch(packageName): Promise<FetchResult> {
    const result = await getJson<PypistatsBody>(
      `https://pypistats.org/api/packages/${encodeURIComponent(packageName)}/overall?mirrors=false`,
    );

    if (!result.ok) return { kind: "failed", detail: result.detail };

    return {
      kind: "ok",
      daily: parsePypistats(result.body),
      total: await lifetimeTotal(packageName),
    };
  },
};
