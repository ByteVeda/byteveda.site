import type { RateLimitConfig } from "./types";

const UNIT_MS: Record<string, number> = { s: 1000, m: 60_000, h: 3_600_000 };

/** Parses FlexiQ's `"10/s"` rate-limit spelling. */
export function parseRateLimit(
  spec: string,
  onExcess: RateLimitConfig["onExcess"] = "defer",
): RateLimitConfig {
  const match = /^(\d+)\s*\/\s*([smh])$/.exec(spec.trim());
  if (!match) throw new Error(`invalid rate limit: ${spec} (expected e.g. "10/s")`);
  const count = Number(match[1]);
  if (count <= 0) throw new Error(`invalid rate limit: ${spec} (count must be positive)`);
  return { count, perMs: UNIT_MS[match[2]], onExcess };
}

/**
 * Continuous-refill token bucket. Capacity equals the window's allowance, so a
 * burst can spend the whole window at once and then drips back at the average
 * rate — the behaviour a caller sees from FlexiQ's dispatch limiter.
 */
export class TokenBucket {
  private tokens: number;
  private lastRefill: number;
  private readonly perMsRate: number;

  constructor(
    private readonly capacity: number,
    perMs: number,
    now = 0,
  ) {
    this.tokens = capacity;
    this.lastRefill = now;
    this.perMsRate = capacity / perMs;
  }

  private refill(now: number): void {
    if (now <= this.lastRefill) return;
    this.tokens = Math.min(this.capacity, this.tokens + (now - this.lastRefill) * this.perMsRate);
    this.lastRefill = now;
  }

  /** Spends a token if one is available. */
  tryTake(now: number): boolean {
    this.refill(now);
    if (this.tokens < 1) return false;
    this.tokens -= 1;
    return true;
  }

  available(now: number): number {
    this.refill(now);
    return Math.floor(this.tokens);
  }
}
