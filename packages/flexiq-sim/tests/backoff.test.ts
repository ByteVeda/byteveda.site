import { describe, expect, it } from "vitest";
import { backoffDelayMs } from "../src/backoff";

const base = { baseMs: 2000, maxMs: 300_000, jitter: false };

describe("backoffDelayMs", () => {
  it("reproduces the cap schedule published in the docs", () => {
    // "Backoff formula": min(M, B * 2^retry_count), B = 2s in the docs' table.
    const delays = [0, 1, 2, 3, 4].map((n) => backoffDelayMs(base, n, () => 0));
    expect(delays).toEqual([2000, 4000, 8000, 16_000, 32_000]);
  });

  it("caps at maxMs", () => {
    expect(backoffDelayMs({ ...base, maxMs: 10_000 }, 10, () => 0)).toBe(10_000);
  });

  it("draws the whole delay from [0, cap] — full jitter, not additive", () => {
    // Matches RetryPolicy::next_retry_at: uniform(0, cap), so a retry can fire
    // immediately and the spread widens as the cap doubles.
    const jittered = { ...base, jitter: true };
    expect(backoffDelayMs(jittered, 0, () => 0)).toBe(0);
    expect(backoffDelayMs(jittered, 0, () => 1)).toBe(2000);
    expect(backoffDelayMs(jittered, 2, () => 0.5)).toBe(4000);
  });

  it("keeps the jittered delay inside the cap it was capped to", () => {
    const capped = { baseMs: 2000, maxMs: 3000, jitter: true };
    for (const r of [0, 1, 5, 9]) {
      expect(backoffDelayMs(capped, r, () => 0.999)).toBeLessThanOrEqual(3000);
    }
  });

  it("clamps the exponent so a long-lived job cannot overflow it", () => {
    // 1i64 << retry_count.min(30) in the Rust; without the clamp 2 ** 4000
    // is Infinity and Math.min would hand back maxMs by luck rather than rule.
    expect(
      backoffDelayMs({ baseMs: 1, maxMs: Number.MAX_SAFE_INTEGER, jitter: false }, 4000, () => 0),
    ).toBe(2 ** 30);
  });
});
