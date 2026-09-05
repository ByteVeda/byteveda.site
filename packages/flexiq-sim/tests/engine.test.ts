import { describe, expect, it } from "vitest";
import { createEngine } from "../src/engine";
import type { EngineConfig, EngineEvent, TaskConfig } from "../src/types";

const task = (over: Partial<TaskConfig> = {}): TaskConfig => ({
  name: "work",
  queue: "default",
  priority: 0,
  durationMs: [10, 10],
  failureRate: 0,
  maxRetries: 3,
  backoff: { baseMs: 1000, maxMs: 300_000, jitter: false },
  ...over,
});

const config = (over: Partial<EngineConfig> = {}): EngineConfig => ({
  seed: 1,
  workers: 4,
  poolKind: "thread",
  tasks: [task()],
  ...over,
});

const collect = (engine: ReturnType<typeof createEngine>) => {
  const events: EngineEvent[] = [];
  engine.on("*", (e) => events.push(e));
  return events;
};

describe("createEngine", () => {
  it("runs a job to completion", () => {
    const engine = createEngine(config());
    engine.enqueue("work");
    engine.tick(1000);
    const snap = engine.snapshot();
    expect(snap.counters.succeeded).toBe(1);
    expect(snap.jobs).toHaveLength(0);
    expect(engine.recentJobs[0].state).toBe("succeeded");
  });

  it("rejects unknown tasks", () => {
    expect(() => createEngine(config()).enqueue("nope")).toThrow(/unknown task/);
  });

  it("produces an identical run for the same seed", () => {
    const run = () => {
      const engine = createEngine(config({ tasks: [task({ failureRate: 0.5 })] }));
      const events = collect(engine);
      engine.enqueue("work", 20);
      engine.tick(30_000);
      return JSON.stringify(events);
    };
    expect(run()).toBe(run());
  });

  it("advances identically regardless of tick granularity", () => {
    const run = (dt: number) => {
      const engine = createEngine(config({ tasks: [task({ failureRate: 0.5 })] }));
      const events = collect(engine);
      engine.enqueue("work", 10);
      for (let t = 0; t < 10_000; t += dt) engine.tick(dt);
      return JSON.stringify(events);
    };
    expect(run(10)).toBe(run(250));
  });

  it("never runs more jobs at once than the pool has workers", () => {
    const engine = createEngine(config({ workers: 3, tasks: [task({ durationMs: [200, 200] })] }));
    engine.enqueue("work", 50);
    let peak = 0;
    for (let t = 0; t < 5000; t += 10) {
      engine.tick(10);
      peak = Math.max(peak, engine.snapshot().jobs.filter((j) => j.state === "running").length);
    }
    expect(peak).toBe(3);
  });

  it("dequeues higher priority first", () => {
    const engine = createEngine(
      config({
        workers: 1,
        tasks: [task({ name: "low", priority: 0 }), task({ name: "high", priority: 10 })],
      }),
    );
    const started: string[] = [];
    engine.on("started", (e) => started.push(e.task));
    engine.enqueue("low", 3);
    engine.enqueue("high", 3);
    engine.tick(1000);
    expect(started.slice(0, 3)).toEqual(["high", "high", "high"]);
  });

  it("retries on the documented curve and then dead-letters", () => {
    const engine = createEngine(config({ tasks: [task({ failureRate: 1, maxRetries: 3 })] }));
    const events = collect(engine);
    engine.enqueue("work");
    engine.tick(60_000);

    // maxRetries counts retries after the first attempt: 1 + 3 = 4 tries.
    expect(events.filter((e) => e.name === "started")).toHaveLength(4);
    expect(events.filter((e) => e.name === "retry_scheduled").map((e) => e.delayMs)).toEqual([
      1000, 2000, 4000,
    ]);

    const snap = engine.snapshot();
    expect(snap.counters.deadLettered).toBe(1);
    expect(snap.dlq).toHaveLength(1);
    expect(snap.dlq[0].state).toBe("dead");
    expect(snap.jobs).toHaveLength(0);
  });

  it("keeps a dead-lettered job in `settling` so a view can animate it there", () => {
    const engine = createEngine(config({ tasks: [task({ failureRate: 1, maxRetries: 0 })] }));
    engine.enqueue("work");
    engine.tick(100);

    // It is out of `jobs` immediately — nothing about it is in flight any more.
    const landed = engine.snapshot();
    expect(landed.jobs).toHaveLength(0);
    expect(landed.settling).toHaveLength(1);
    expect(landed.settling[0].state).toBe("dead");
    // Without `finishedAt` a view cannot tell how far through the fade it is.
    expect(landed.settling[0].finishedAt).toBeGreaterThan(0);
    expect(landed.settling[0].finishedAt).toBeLessThanOrEqual(landed.now);

    // ...and it leaves once it has had time to arrive.
    engine.tick(2000);
    expect(engine.snapshot().settling).toHaveLength(0);
    // Leaving `settling` is presentational: the DLQ itself still holds it.
    expect(engine.snapshot().dlq).toHaveLength(1);
  });

  it("settles dropped jobs too, and clears them on reset", () => {
    const engine = createEngine(
      config({
        // Enough free workers that dispatch actually reaches the limiter:
        // with none free it returns early and nothing is ever turned away.
        workers: 4,
        tasks: [
          task({
            durationMs: [500, 500],
            rateLimit: { count: 1, perMs: 10_000, onExcess: "drop" },
          }),
        ],
      }),
    );
    engine.enqueue("work", 4);
    engine.tick(200);

    const snap = engine.snapshot();
    expect(snap.counters.dropped).toBeGreaterThan(0);
    expect(snap.settling.every((job) => job.state === "dropped")).toBe(true);
    expect(snap.settling.length).toBe(snap.counters.dropped);

    engine.reset();
    expect(engine.snapshot().settling).toHaveLength(0);
  });

  it("does not retry when maxRetries is zero", () => {
    const engine = createEngine(config({ tasks: [task({ failureRate: 1, maxRetries: 0 })] }));
    engine.enqueue("work");
    engine.tick(5000);
    const snap = engine.snapshot();
    expect(snap.counters.retried).toBe(0);
    expect(snap.counters.deadLettered).toBe(1);
  });

  it("caps throughput at the configured rate limit", () => {
    const engine = createEngine(
      config({
        workers: 8,
        tasks: [task({ rateLimit: { count: 5, perMs: 1000, onExcess: "defer" } })],
      }),
    );
    engine.enqueue("work", 100);
    engine.tick(3000);
    // The bucket starts full, then drips: at most capacity + rate * elapsed.
    expect(engine.snapshot().counters.started).toBeLessThanOrEqual(5 + 5 * 3);
  });

  it("sheds excess work when on_excess is drop", () => {
    const engine = createEngine(
      config({
        workers: 8,
        tasks: [task({ rateLimit: { count: 1, perMs: 1000, onExcess: "drop" } })],
      }),
    );
    engine.enqueue("work", 20);
    engine.tick(10);
    const snap = engine.snapshot();
    expect(snap.counters.started).toBe(1);
    expect(snap.counters.dropped).toBe(19);
    expect(snap.jobs.filter((j) => j.state === "pending")).toHaveLength(0);
  });

  it("requeues a killed worker's job without spending a retry", () => {
    const engine = createEngine(
      config({ workers: 1, tasks: [task({ durationMs: [1000, 1000] })] }),
    );
    engine.enqueue("work");
    engine.tick(100);
    expect(engine.snapshot().jobs[0].state).toBe("running");

    engine.killWorker(0);
    const afterKill = engine.snapshot();
    expect(afterKill.workers[0].alive).toBe(false);
    expect(afterKill.jobs[0].state).toBe("pending");
    expect(afterKill.jobs[0].attempt).toBe(0);
    expect(afterKill.counters.failed).toBe(0);

    // The supervisor brings the worker back and the job runs to completion.
    engine.tick(5000);
    expect(engine.snapshot().counters.succeeded).toBe(1);
  });

  it("enqueues periodic tasks from the cron schedule", () => {
    const engine = createEngine(config({ tasks: [task({ cron: "*/2 * * * * *" })] }));
    const fired: number[] = [];
    engine.on("cron_fired", (e) => fired.push(e.at));
    engine.tick(10_000);
    expect(fired).toEqual([2000, 4000, 6000, 8000, 10_000]);
  });

  it("holds delayed jobs until their delay elapses", () => {
    const engine = createEngine(config());
    engine.enqueue("work", 1, { delayMs: 2000 });
    engine.tick(1000);
    expect(engine.snapshot().counters.started).toBe(0);
    engine.tick(1500);
    expect(engine.snapshot().counters.started).toBe(1);
  });

  it("reset returns the engine to its initial state", () => {
    const engine = createEngine(config());
    engine.enqueue("work", 5);
    engine.tick(2000);
    engine.reset();
    const snap = engine.snapshot();
    expect(snap.now).toBe(0);
    expect(snap.counters.enqueued).toBe(0);
    expect(snap.jobs).toHaveLength(0);
    expect(engine.recentJobs).toHaveLength(0);
  });
});

describe("configuration isolation", () => {
  it("never mutates the caller's config", () => {
    const original = config({ tasks: [task({ failureRate: 0.1 })] });
    const engine = createEngine(original);
    engine.setFailureRate("work", 0.9);
    expect(original.tasks[0].failureRate).toBe(0.1);
  });

  it("reset restores the configured failure rate", () => {
    const engine = createEngine(config({ tasks: [task({ failureRate: 0, maxRetries: 0 })] }));
    engine.setFailureRate("work", 1);
    engine.enqueue("work");
    engine.tick(1000);
    expect(engine.snapshot().counters.deadLettered).toBe(1);

    engine.reset();
    engine.enqueue("work");
    engine.tick(1000);
    expect(engine.snapshot().counters.succeeded).toBe(1);
  });
});
