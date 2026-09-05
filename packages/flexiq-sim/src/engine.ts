import { backoffDelayMs } from "./backoff";
import { type CronSchedule, nextFire, parseCron } from "./cron";
import { eligible } from "./queue";
import { TokenBucket } from "./rate-limit";
import { createRng, randInt } from "./rng";
import type {
  Counters,
  EngineConfig,
  EngineEvent,
  EngineSnapshot,
  EventName,
  Job,
  QueueView,
  TaskConfig,
  WorkerView,
} from "./types";

/**
 * The clock advances in fixed 10 ms slices no matter how large a `tick` is, so
 * a 144 Hz monitor, a 30 fps one, and a headless test all produce the same run.
 * Determinism is what makes share links replayable and the semantics testable.
 */
const STEP_MS = 10;

/** How long a killed worker stays down before its supervisor brings it back. */
const WORKER_RESTART_MS = 2000;

/** Finished jobs kept for the job table. Older ones fall off. */
const RECENT_LIMIT = 200;

/**
 * How long a job that reached the dead-letter queue stays in `settling`.
 *
 * A job leaves `jobs` the instant it dead-letters, which is correct for every
 * consumer that asks "what is in flight" — and wrong for the one that draws
 * the board, because a dot that is removed mid-journey vanishes at the
 * scheduler instead of arriving anywhere. `settling` holds it just long enough
 * for a view to animate it into the DLQ. Nothing in the simulation reads it.
 */
const SETTLE_MS = 1500;

export interface EnqueueOptions {
  /** Delayed job: created immediately, ineligible until the delay elapses. */
  delayMs?: number;
  /** Overrides the task's configured priority for this job. */
  priority?: number;
}

export interface Engine {
  enqueue(task: string, count?: number, options?: EnqueueOptions): void;
  tick(dtMs: number): void;
  snapshot(): EngineSnapshot;
  on(event: EventName | "*", cb: (event: EngineEvent) => void): () => void;
  killWorker(id: number): void;
  setFailureRate(task: string, rate: number): void;
  reset(): void;
  /** Finished jobs, newest first — the job table's backing list. */
  readonly recentJobs: Job[];
}

interface CronState {
  schedule: CronSchedule;
  next: number;
}

interface Listener {
  event: EventName | "*";
  cb: (event: EngineEvent) => void;
}

function emptyCounters(): Counters {
  return {
    enqueued: 0,
    started: 0,
    succeeded: 0,
    failed: 0,
    retried: 0,
    deadLettered: 0,
    dropped: 0,
    rateLimited: 0,
  };
}

class SimEngine implements Engine {
  private now = 0;
  private carry = 0;
  private seq = 0;
  private nextId = 1;
  private rand: () => number;

  private tasks = new Map<string, TaskConfig>();
  private buckets = new Map<string, TokenBucket>();
  private crons = new Map<string, CronState>();

  private jobs = new Map<string, Job>();
  private recent: Job[] = [];
  private dlq: Job[] = [];
  /** Terminal jobs still travelling to the DLQ on screen. See `SETTLE_MS`. */
  private settling: Job[] = [];
  private workers: WorkerView[] = [];
  private counters = emptyCounters();

  /**
   * Whether an in-flight job is destined to fail. Decided at dispatch so the
   * outcome consumes randomness at a fixed point in the sequence, and kept off
   * `Job` so the renderer cannot accidentally reveal the future.
   */
  private outcomes = new Map<string, boolean>();
  private reviveAt = new Map<number, number>();
  private listeners: Listener[] = [];

  constructor(private readonly config: EngineConfig) {
    this.rand = createRng(config.seed);
    this.build();
  }

  private build(): void {
    this.tasks.clear();
    this.buckets.clear();
    this.crons.clear();
    for (const task of this.config.tasks) {
      // Cloned, not referenced: `setFailureRate` edits the live copy, and the
      // caller's config has to stay pristine so `reset` really resets.
      this.tasks.set(task.name, {
        ...task,
        durationMs: [...task.durationMs],
        backoff: { ...task.backoff },
        rateLimit: task.rateLimit ? { ...task.rateLimit } : undefined,
      });
      if (task.rateLimit) {
        this.buckets.set(task.name, new TokenBucket(task.rateLimit.count, task.rateLimit.perMs, 0));
      }
      if (task.cron) {
        const schedule = parseCron(task.cron);
        this.crons.set(task.name, { schedule, next: nextFire(schedule, 0) });
      }
    }
    this.workers = Array.from({ length: this.config.workers }, (_, id) => ({
      id,
      alive: true,
      jobId: null,
      busyUntil: 0,
    }));
  }

  private emit(event: EngineEvent): void {
    for (const listener of this.listeners) {
      if (listener.event === "*" || listener.event === event.name) listener.cb(event);
    }
  }

  on(event: EventName | "*", cb: (event: EngineEvent) => void): () => void {
    const listener: Listener = { event, cb };
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  enqueue(task: string, count = 1, options: EnqueueOptions = {}): void {
    const config = this.tasks.get(task);
    if (!config) throw new Error(`unknown task: ${task}`);
    for (let i = 0; i < count; i++) {
      const job: Job = {
        id: `job-${this.nextId++}`,
        task,
        queue: config.queue,
        priority: options.priority ?? config.priority,
        state: "pending",
        attempt: 0,
        seq: this.seq++,
        enqueuedAt: this.now,
        runAt: this.now + (options.delayMs ?? 0),
      };
      this.jobs.set(job.id, job);
      this.counters.enqueued++;
      this.emit({ name: "enqueued", at: this.now, jobId: job.id, task });
    }
  }

  tick(dtMs: number): void {
    this.carry += dtMs;
    while (this.carry >= STEP_MS) {
      this.carry -= STEP_MS;
      this.step();
    }
  }

  private step(): void {
    this.now += STEP_MS;
    this.fireCrons();
    this.reviveWorkers();
    this.completeRunning();
    this.dispatch();
    this.pruneSettling();
  }

  private pruneSettling(): void {
    if (this.settling.length === 0) return;
    this.settling = this.settling.filter((job) => this.now - (job.finishedAt ?? 0) < SETTLE_MS);
  }

  private fireCrons(): void {
    for (const [task, state] of this.crons) {
      while (state.next <= this.now) {
        this.enqueue(task, 1);
        this.emit({ name: "cron_fired", at: this.now, task });
        state.next = nextFire(state.schedule, state.next);
      }
    }
  }

  private reviveWorkers(): void {
    for (const [id, at] of this.reviveAt) {
      if (at > this.now) continue;
      const worker = this.workers[id];
      if (worker) worker.alive = true;
      this.reviveAt.delete(id);
    }
  }

  private completeRunning(): void {
    for (const worker of this.workers) {
      if (!worker.jobId || worker.busyUntil > this.now) continue;
      const job = this.jobs.get(worker.jobId);
      worker.jobId = null;
      worker.busyUntil = 0;
      if (!job) continue;
      this.resolve(job, worker.id);
    }
  }

  private resolve(job: Job, workerId: number): void {
    const task = this.tasks.get(job.task);
    if (!task) return;
    job.finishedAt = this.now;
    const failed = this.outcomes.get(job.id) ?? false;
    this.outcomes.delete(job.id);

    if (!failed) {
      job.state = "succeeded";
      this.counters.succeeded++;
      this.emit({
        name: "succeeded",
        at: this.now,
        jobId: job.id,
        task: job.task,
        workerId,
        attempt: job.attempt,
      });
      this.retire(job);
      return;
    }

    this.counters.failed++;
    this.emit({
      name: "failed",
      at: this.now,
      jobId: job.id,
      task: job.task,
      workerId,
      attempt: job.attempt,
    });

    // `maxRetries` counts retries *after* the first attempt, so a job with
    // `maxRetries: 3` gets four tries in total before it dead-letters.
    if (job.attempt < task.maxRetries) {
      const delayMs = backoffDelayMs(task.backoff, job.attempt, this.rand);
      job.attempt++;
      job.state = "retrying";
      job.runAt = this.now + delayMs;
      job.startedAt = undefined;
      job.workerId = undefined;
      this.counters.retried++;
      this.emit({
        name: "retry_scheduled",
        at: this.now,
        jobId: job.id,
        task: job.task,
        delayMs,
        attempt: job.attempt,
      });
      return;
    }

    job.state = "dead";
    job.finishedAt = this.now;
    this.counters.deadLettered++;
    this.emit({ name: "dead_lettered", at: this.now, jobId: job.id, task: job.task });
    this.jobs.delete(job.id);
    this.dlq.push(job);
    this.settling.push({ ...job });
  }

  private retire(job: Job): void {
    this.jobs.delete(job.id);
    this.recent.unshift(job);
    if (this.recent.length > RECENT_LIMIT) this.recent.length = RECENT_LIMIT;
  }

  private dispatch(): void {
    const free = this.workers.filter((w) => w.alive && w.jobId === null);
    if (free.length === 0) return;

    // A deferred job is retried on the next step, so the event would otherwise
    // fire every 10 ms for as long as the limit holds. One per task per step.
    const limited = new Set<string>();
    let next = 0;

    for (const job of eligible(this.jobs.values(), this.now)) {
      if (next >= free.length) break;
      const task = this.tasks.get(job.task);
      if (!task) continue;

      const bucket = this.buckets.get(job.task);
      if (bucket && !bucket.tryTake(this.now)) {
        if (!limited.has(job.task)) {
          limited.add(job.task);
          this.counters.rateLimited++;
          this.emit({ name: "rate_limited", at: this.now, jobId: job.id, task: job.task });
        }
        if (task.rateLimit?.onExcess === "drop") {
          job.state = "dropped";
          job.finishedAt = this.now;
          this.counters.dropped++;
          this.emit({ name: "dropped", at: this.now, jobId: job.id, task: job.task });
          this.settling.push({ ...job });
          this.retire(job);
        }
        continue;
      }

      const worker = free[next++];
      const durationMs = randInt(this.rand, task.durationMs[0], task.durationMs[1]);
      job.state = "running";
      job.startedAt = this.now;
      job.workerId = worker.id;
      job.durationMs = durationMs;
      worker.jobId = job.id;
      worker.busyUntil = this.now + durationMs;
      this.outcomes.set(job.id, this.rand() < task.failureRate);
      this.counters.started++;
      this.emit({
        name: "started",
        at: this.now,
        jobId: job.id,
        task: job.task,
        workerId: worker.id,
        attempt: job.attempt,
      });
    }
  }

  killWorker(id: number): void {
    const worker = this.workers[id];
    if (!worker?.alive) return;
    worker.alive = false;
    this.reviveAt.set(id, this.now + WORKER_RESTART_MS);

    // A crashed worker is not a failed task: the job goes back on the queue
    // with its retry budget untouched, the way a reclaimed lease behaves.
    if (worker.jobId) {
      const job = this.jobs.get(worker.jobId);
      if (job) {
        job.state = "pending";
        job.runAt = this.now;
        job.startedAt = undefined;
        job.workerId = undefined;
        this.outcomes.delete(job.id);
      }
      worker.jobId = null;
      worker.busyUntil = 0;
    }
    this.emit({ name: "worker_killed", at: this.now, task: "", workerId: id });
  }

  setFailureRate(task: string, rate: number): void {
    const config = this.tasks.get(task);
    if (config) config.failureRate = Math.min(1, Math.max(0, rate));
  }

  reset(): void {
    this.now = 0;
    this.carry = 0;
    this.seq = 0;
    this.nextId = 1;
    this.rand = createRng(this.config.seed);
    this.jobs.clear();
    this.outcomes.clear();
    this.reviveAt.clear();
    this.recent = [];
    this.dlq = [];
    this.settling = [];
    this.counters = emptyCounters();
    this.build();
  }

  snapshot(): EngineSnapshot {
    const queues = new Map<string, QueueView>();
    for (const task of this.tasks.values()) {
      if (!queues.has(task.queue))
        queues.set(task.queue, { name: task.queue, pending: 0, running: 0 });
    }
    const jobs: Job[] = [];
    for (const job of this.jobs.values()) {
      jobs.push({ ...job });
      const view = queues.get(job.queue);
      if (!view) continue;
      if (job.state === "running") view.running++;
      else view.pending++;
    }
    return {
      now: this.now,
      jobs,
      workers: this.workers.map((w) => ({ ...w })),
      queues: [...queues.values()],
      dlq: this.dlq.map((j) => ({ ...j })),
      settling: this.settling.map((j) => ({ ...j })),
      counters: { ...this.counters },
    };
  }

  /** Finished jobs, newest first — the job table's backing list. */
  get recentJobs(): Job[] {
    return this.recent;
  }
}

export function createEngine(config: EngineConfig): Engine {
  return new SimEngine(config);
}
