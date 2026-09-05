/**
 * A six-field cron parser (`sec min hour dom mon dow`), matching the spelling
 * FlexiQ's periodic tasks use — `"0 0 9 * * *"` is 09:00 daily.
 *
 * Everything is evaluated in UTC. The real scheduler honours a `timezone`
 * argument; the simulation runs on a virtual clock with no location, so
 * offering a timezone here would be a claim it cannot keep.
 */

export interface CronSchedule {
  second: Set<number>;
  minute: Set<number>;
  hour: Set<number>;
  dayOfMonth: Set<number>;
  month: Set<number>;
  dayOfWeek: Set<number>;
  /** Standard cron: when both day fields are restricted, either may match. */
  domRestricted: boolean;
  dowRestricted: boolean;
}

const RANGES: Array<[number, number]> = [
  [0, 59], // second
  [0, 59], // minute
  [0, 23], // hour
  [1, 31], // day of month
  [1, 12], // month
  [0, 6], // day of week, 0 = Sunday
];

function parseField(raw: string, [lo, hi]: [number, number]): Set<number> {
  const out = new Set<number>();
  for (const part of raw.split(",")) {
    const [spec, stepRaw] = part.split("/");
    const step = stepRaw === undefined ? 1 : Number(stepRaw);
    if (!Number.isInteger(step) || step < 1) throw new Error(`invalid cron step: ${part}`);

    let from: number;
    let to: number;
    if (spec === "*") {
      from = lo;
      to = hi;
    } else if (spec.includes("-")) {
      const [a, b] = spec.split("-").map(Number);
      from = a;
      to = b;
    } else {
      from = Number(spec);
      to = stepRaw === undefined ? from : hi;
    }

    if (!Number.isInteger(from) || !Number.isInteger(to) || from < lo || to > hi || from > to) {
      throw new Error(`invalid cron field: ${part}`);
    }
    for (let v = from; v <= to; v += step) out.add(v);
  }
  return out;
}

export function parseCron(expr: string): CronSchedule {
  const fields = expr.trim().split(/\s+/);
  if (fields.length !== 6) {
    throw new Error(`invalid cron: ${expr} (expected 6 fields: sec min hour dom mon dow)`);
  }
  const sets = fields.map((f, i) => parseField(f, RANGES[i]));
  return {
    second: sets[0],
    minute: sets[1],
    hour: sets[2],
    dayOfMonth: sets[3],
    month: sets[4],
    dayOfWeek: sets[5],
    domRestricted: fields[3] !== "*",
    dowRestricted: fields[5] !== "*",
  };
}

function dayMatches(schedule: CronSchedule, date: Date): boolean {
  const dom = schedule.dayOfMonth.has(date.getUTCDate());
  const dow = schedule.dayOfWeek.has(date.getUTCDay());
  if (schedule.domRestricted && schedule.dowRestricted) return dom || dow;
  if (schedule.domRestricted) return dom;
  if (schedule.dowRestricted) return dow;
  return true;
}

/**
 * The first matching instant strictly after `fromMs`.
 *
 * Walks coarsest field to finest and resets everything below whenever it
 * carries, so a sparse schedule converges in a few hundred steps rather than
 * scanning second by second across a year.
 */
export function nextFire(schedule: CronSchedule, fromMs: number): number {
  const date = new Date(Math.floor(fromMs / 1000) * 1000 + 1000);

  for (let guard = 0; guard < 200_000; guard++) {
    if (!schedule.month.has(date.getUTCMonth() + 1)) {
      date.setUTCMonth(date.getUTCMonth() + 1, 1);
      date.setUTCHours(0, 0, 0, 0);
      continue;
    }
    if (!dayMatches(schedule, date)) {
      date.setUTCDate(date.getUTCDate() + 1);
      date.setUTCHours(0, 0, 0, 0);
      continue;
    }
    if (!schedule.hour.has(date.getUTCHours())) {
      date.setUTCHours(date.getUTCHours() + 1, 0, 0, 0);
      continue;
    }
    if (!schedule.minute.has(date.getUTCMinutes())) {
      date.setUTCMinutes(date.getUTCMinutes() + 1, 0, 0);
      continue;
    }
    if (!schedule.second.has(date.getUTCSeconds())) {
      date.setUTCSeconds(date.getUTCSeconds() + 1, 0);
      continue;
    }
    return date.getTime();
  }
  throw new Error("cron schedule never fires");
}
