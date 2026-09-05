import { describe, expect, it } from "vitest";
import { eligible } from "../src/queue";
import type { Job } from "../src/types";

const job = (over: Partial<Job>): Job => ({
  id: "j",
  task: "t",
  queue: "default",
  priority: 0,
  state: "pending",
  attempt: 0,
  seq: 0,
  enqueuedAt: 0,
  runAt: 0,
  ...over,
});

describe("eligible", () => {
  it("orders by priority, then FIFO on ties", () => {
    const jobs = [
      job({ id: "a", priority: 0, seq: 0 }),
      job({ id: "b", priority: 10, seq: 1 }),
      job({ id: "c", priority: 10, seq: 2 }),
      job({ id: "d", priority: 5, seq: 3 }),
    ];
    expect(eligible(jobs, 0).map((j) => j.id)).toEqual(["b", "c", "d", "a"]);
  });

  it("excludes jobs whose runAt is in the future", () => {
    const jobs = [job({ id: "now", runAt: 0 }), job({ id: "later", seq: 1, runAt: 500 })];
    expect(eligible(jobs, 100).map((j) => j.id)).toEqual(["now"]);
  });

  it("includes retrying jobs once their backoff has elapsed", () => {
    const jobs = [job({ id: "r", state: "retrying", runAt: 300 })];
    expect(eligible(jobs, 200)).toHaveLength(0);
    expect(eligible(jobs, 300)).toHaveLength(1);
  });

  it("ignores terminal states", () => {
    const jobs = [
      job({ id: "s", state: "succeeded" }),
      job({ id: "d", state: "dead" }),
      job({ id: "x", state: "dropped" }),
      job({ id: "run", state: "running" }),
    ];
    expect(eligible(jobs, 1000)).toHaveLength(0);
  });
});
