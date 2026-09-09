import { daysAgo, getJson, utcDay } from "../http";
import type { Adapter, DailyPoint, FetchResult } from "../types";

type NpmRangeBody = { downloads?: { day: string; downloads: number }[] };

/** The registry caps one range request at 18 months; 180 days is the backfill. */
const BACKFILL_DAYS = 180;

export function parseNpmRange(body: NpmRangeBody): DailyPoint[] {
  return (body.downloads ?? [])
    .filter((row) => row?.day && typeof row.downloads === "number" && row.downloads >= 0)
    .map((row) => ({ day: row.day, downloads: row.downloads }))
    .sort((a, b) => a.day.localeCompare(b.day));
}

export const npm: Adapter = {
  ecosystem: "npm",
  label: "npm",
  hint: "The published name, scope included — for example, @byteveda/flexiq",

  async fetch(packageName, options): Promise<FetchResult> {
    const start = options?.since ?? daysAgo(BACKFILL_DAYS);
    const end = utcDay(new Date());

    // A scoped name contains a slash, which is a path separator here and must
    // survive rather than be encoded.
    const result = await getJson<NpmRangeBody>(
      `https://api.npmjs.org/downloads/range/${start}:${end}/${packageName}`,
    );

    if (!result.ok) return { kind: "failed", detail: result.detail };
    return { kind: "ok", daily: parseNpmRange(result.body) };
  },
};
