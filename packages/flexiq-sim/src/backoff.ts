import type { BackoffConfig } from "./types";

/**
 * FlexiQ's retry curve, ported from `RetryPolicy::next_retry_at` in
 * `flexiq-core/src/resilience/retry.rs`:
 *
 *     cap   = min(max_delay, base_delay * 2^retry_count)
 *     delay = uniform(0, cap)
 *
 * This is AWS "Full Jitter", and the distinction matters enough that the core
 * documents it: the *whole* delay is drawn from the range rather than a fixed
 * jitter being added on top of a deterministic backoff. That is what actually
 * spreads a wave of jobs retrying the same failed downstream, because the
 * spread grows with the cap instead of staying a fixed width.
 *
 * `retryCount` is zero-based, so the first retry draws from `[0, baseMs]`. The
 * shift is clamped at 30 the way the Rust clamps it, so a long-lived job can't
 * overflow the exponent. With `jitter: false` the delay is the cap itself —
 * the deterministic curve, which is what the docs' table lists and what the
 * playground draws when it needs a legible, repeatable ladder.
 */
export function backoffDelayMs(cfg: BackoffConfig, retryCount: number, rand: () => number): number {
  const cap = Math.min(cfg.maxMs, cfg.baseMs * 2 ** Math.min(retryCount, 30));
  return cfg.jitter ? rand() * cap : cap;
}
