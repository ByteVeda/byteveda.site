const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * Compact relative time — "2h", "3d", "just now". Long enough ago, a date.
 *
 * Locale and time zone are pinned rather than left to the runtime: this also
 * runs while server-rendering a client component, and a server whose locale
 * differs from the browser's produces a different string and a hydration
 * mismatch.
 */
export function ago(value: Date | string, now = Date.now()): string {
  const then = new Date(value).getTime();
  const elapsed = now - then;

  if (elapsed < MINUTE) return "just now";
  if (elapsed < HOUR) return `${Math.floor(elapsed / MINUTE)}m`;
  if (elapsed < DAY) return `${Math.floor(elapsed / HOUR)}h`;
  if (elapsed < 30 * DAY) return `${Math.floor(elapsed / DAY)}d`;

  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

/** Thousands separators, and a compact form once the numbers get long. */
export function count(value: number): string {
  if (value < 10_000) return value.toLocaleString("en-US");
  if (value < 1_000_000) return `${(value / 1000).toFixed(value < 100_000 ? 1 : 0)}k`;
  return `${(value / 1_000_000).toFixed(1)}M`;
}

/** Signed percentage, or a dash when there is nothing to compare against. */
export function delta(current: number, previous: number): { label: string; tone: string } {
  if (previous <= 0) return { label: "—", tone: "delta-flat" };

  const change = ((current - previous) / previous) * 100;
  if (Math.abs(change) < 0.05) return { label: "0.0%", tone: "delta-flat" };

  return {
    label: `${change > 0 ? "+" : "−"}${Math.abs(change).toFixed(1)}%`,
    tone: change > 0 ? "delta-up" : "delta-down",
  };
}
