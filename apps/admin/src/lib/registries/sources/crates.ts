import { getJson } from "../http";
import type { Adapter, DailyPoint, FetchResult, LifetimeTotal } from "../types";

type CratesDownloadsBody = {
  version_downloads?: { date: string; downloads: number }[];
  meta?: { extra_downloads?: { date: string; downloads: number }[] };
};

type CratesCrateBody = { crate?: { downloads?: number } };

/**
 * crates.io splits a day's downloads across versions, plus an `extra_downloads`
 * bucket for versions it no longer itemises. A day's real total is the sum of
 * both, so anything that reads only `version_downloads` undercounts.
 */
export function parseCratesDownloads(body: CratesDownloadsBody): DailyPoint[] {
  const byDay = new Map<string, number>();

  const add = (rows: { date: string; downloads: number }[] | undefined) => {
    for (const row of rows ?? []) {
      if (!row?.date || typeof row.downloads !== "number" || row.downloads < 0) continue;
      byDay.set(row.date, (byDay.get(row.date) ?? 0) + row.downloads);
    }
  };

  add(body.version_downloads);
  add(body.meta?.extra_downloads);

  return [...byDay.entries()]
    .map(([day, downloads]) => ({ day, downloads }))
    .sort((a, b) => a.day.localeCompare(b.day));
}

export function parseCratesTotal(body: CratesCrateBody): LifetimeTotal | undefined {
  const total = body?.crate?.downloads;
  return typeof total === "number" && total >= 0
    ? { value: total, source: "crates.io" }
    : undefined;
}

export const crates: Adapter = {
  ecosystem: "crates",
  label: "crates.io",
  hint: "The crate name — for example, flexiq",

  async fetch(packageName): Promise<FetchResult> {
    const name = encodeURIComponent(packageName);

    // The daily series only reaches back ~90 days; the crate endpoint carries
    // the lifetime figure, so both are worth having.
    const [daily, crate] = await Promise.all([
      getJson<CratesDownloadsBody>(`https://crates.io/api/v1/crates/${name}/downloads`),
      getJson<CratesCrateBody>(`https://crates.io/api/v1/crates/${name}`),
    ]);

    if (!daily.ok) return { kind: "failed", detail: daily.detail };

    return {
      kind: "ok",
      daily: parseCratesDownloads(daily.body),
      total: crate.ok ? parseCratesTotal(crate.body) : undefined,
    };
  },
};
