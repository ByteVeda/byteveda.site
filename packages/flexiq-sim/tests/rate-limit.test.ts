import { describe, expect, it } from "vitest";
import { parseRateLimit, TokenBucket } from "../src/rate-limit";

describe("parseRateLimit", () => {
  it("parses the units FlexiQ accepts", () => {
    expect(parseRateLimit("10/s")).toEqual({ count: 10, perMs: 1000, onExcess: "defer" });
    expect(parseRateLimit("100/m")).toEqual({ count: 100, perMs: 60_000, onExcess: "defer" });
    expect(parseRateLimit("2/h")).toEqual({ count: 2, perMs: 3_600_000, onExcess: "defer" });
  });

  it("carries on_excess through", () => {
    expect(parseRateLimit("10/s", "drop").onExcess).toBe("drop");
  });

  it("rejects malformed specs", () => {
    expect(() => parseRateLimit("10")).toThrow();
    expect(() => parseRateLimit("10/d")).toThrow();
    expect(() => parseRateLimit("0/s")).toThrow();
  });
});

describe("TokenBucket", () => {
  it("starts full so a burst can spend the window at once", () => {
    const bucket = new TokenBucket(3, 1000);
    expect([0, 0, 0].every(() => bucket.tryTake(0))).toBe(true);
    expect(bucket.tryTake(0)).toBe(false);
  });

  it("refills continuously at the average rate", () => {
    const bucket = new TokenBucket(10, 1000);
    for (let i = 0; i < 10; i++) bucket.tryTake(0);
    expect(bucket.tryTake(0)).toBe(false);
    expect(bucket.tryTake(100)).toBe(true); // 100ms at 10/s buys exactly one
    expect(bucket.tryTake(100)).toBe(false);
  });

  it("never exceeds capacity while idle", () => {
    const bucket = new TokenBucket(5, 1000);
    expect(bucket.available(100_000)).toBe(5);
  });
});
