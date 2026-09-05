import { describe, expect, it } from "vitest";
import { nextFire, parseCron } from "../src/cron";

const at = (iso: string) => Date.parse(iso);

describe("parseCron", () => {
  it("requires six fields", () => {
    expect(() => parseCron("0 9 * * *")).toThrow();
    expect(() => parseCron("0 0 9 * * *")).not.toThrow();
  });

  it("expands steps, ranges and lists", () => {
    expect([...parseCron("*/15 * * * * *").second]).toEqual([0, 15, 30, 45]);
    expect([...parseCron("0 1-3 * * * *").minute]).toEqual([1, 2, 3]);
    expect([...parseCron("0 5,10 * * * *").minute]).toEqual([5, 10]);
  });

  it("rejects out-of-range values", () => {
    expect(() => parseCron("60 * * * * *")).toThrow();
    expect(() => parseCron("* * * * 13 *")).toThrow();
  });
});

describe("nextFire", () => {
  it("finds the next second-level tick", () => {
    const schedule = parseCron("*/2 * * * * *");
    expect(nextFire(schedule, 0)).toBe(2000);
    expect(nextFire(schedule, 2000)).toBe(4000);
  });

  it("finds a daily 09:00 fire", () => {
    const schedule = parseCron("0 0 9 * * *");
    expect(nextFire(schedule, at("2026-06-16T00:00:00Z"))).toBe(at("2026-06-16T09:00:00Z"));
    expect(nextFire(schedule, at("2026-06-16T09:00:00Z"))).toBe(at("2026-06-17T09:00:00Z"));
  });

  it("honours day-of-week restrictions", () => {
    // 2026-06-16 is a Tuesday; the next Monday 00:00 is the 22nd.
    const schedule = parseCron("0 0 0 * * 1");
    expect(nextFire(schedule, at("2026-06-16T12:00:00Z"))).toBe(at("2026-06-22T00:00:00Z"));
  });

  it("is strictly after the given instant", () => {
    const schedule = parseCron("0 * * * * *");
    expect(nextFire(schedule, at("2026-06-16T10:00:00Z"))).toBe(at("2026-06-16T10:01:00Z"));
  });
});
