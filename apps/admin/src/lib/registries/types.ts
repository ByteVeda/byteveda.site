import type { Ecosystem } from "@byteveda/db";

/** One day's downloads. `day` is `YYYY-MM-DD` in UTC. */
export type DailyPoint = { day: string; downloads: number };

export type LifetimeTotal = { value: number; source: string };

/**
 * Three outcomes, kept apart on purpose.
 *
 * `unsupported` is not a failure — Maven Central simply has no public download
 * API — and showing it as one would train the operator to ignore red.
 */
export type FetchResult =
  | { kind: "ok"; daily: DailyPoint[]; total?: LifetimeTotal }
  | { kind: "unsupported"; detail: string }
  | { kind: "failed"; detail: string };

export type FetchOptions = {
  /** Earliest day worth asking for, `YYYY-MM-DD`. Adapters may return more. */
  since?: string;
};

export type Adapter = {
  ecosystem: Ecosystem;
  label: string;
  /** How a package is named here, shown in the UI when adding one. */
  hint: string;
  fetch(packageName: string, options?: FetchOptions): Promise<FetchResult>;
};
