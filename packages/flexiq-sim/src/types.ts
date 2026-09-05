/**
 * The simulation's vocabulary, kept deliberately close to FlexiQ's own so the
 * playground's generated code snippets read as real SDK calls rather than a
 * translation of them.
 */

/** Where a job is in its life. `retrying` is `pending` with a backoff deadline. */
export type JobState = "pending" | "running" | "retrying" | "succeeded" | "dead" | "dropped";

export interface BackoffConfig {
  /** `retry_backoff` / `retryBackoff.baseMs` — the first delay, then it doubles. */
  baseMs: number;
  /** `max_retry_delay` / `retryBackoff.maxMs` — cap on the computed delay. */
  maxMs: number;
  /**
   * Full Jitter: draw the delay uniformly from `[0, cap]` instead of using the
   * cap itself, so a wave of jobs retrying the same downstream spreads out.
   * `false` gives the bare exponential ladder — the curve the docs tabulate.
   */
  jitter: boolean;
}

export interface RateLimitConfig {
  /** Tokens per window — the `10` in `"10/s"`. */
  count: number;
  /** Window length in ms: 1000 for `/s`, 60_000 for `/m`, 3_600_000 for `/h`. */
  perMs: number;
  /** What happens to work the limit turns away. FlexiQ's `on_excess`. */
  onExcess: "defer" | "drop";
}

export interface TaskConfig {
  name: string;
  queue: string;
  /** Higher dequeues first within a queue. A plain integer, no fixed scale. */
  priority: number;
  /** Inclusive `[min, max]` execution time, sampled per attempt. */
  durationMs: [number, number];
  /** Injected failure probability in `[0, 1]`, sampled per attempt. */
  failureRate: number;
  /** Retries *after* the first attempt. `maxRetries: 3` means 4 tries in total. */
  maxRetries: number;
  backoff: BackoffConfig;
  rateLimit?: RateLimitConfig;
  /** Six-field cron (`sec min hour dom mon dow`), evaluated in UTC. */
  cron?: string;
}

export interface EngineConfig {
  /** Seeds the PRNG. Same seed plus same tick sequence means the same run. */
  seed: number;
  workers: number;
  /**
   * Visual and code-generation label only. The pool kind changes which SDK
   * snippet the playground emits; it deliberately does not fudge timings,
   * because the simulation has no measured basis for a GIL-contention factor.
   */
  poolKind: "thread" | "prefork";
  tasks: TaskConfig[];
}

export interface Job {
  id: string;
  task: string;
  queue: string;
  priority: number;
  state: JobState;
  /** Retries already consumed. `0` while on the first attempt. */
  attempt: number;
  /** Enqueue order, used to break priority ties FIFO. */
  seq: number;
  enqueuedAt: number;
  /** Not eligible for dispatch before this instant. */
  runAt: number;
  startedAt?: number;
  finishedAt?: number;
  durationMs?: number;
  workerId?: number;
}

export interface WorkerView {
  id: number;
  alive: boolean;
  jobId: string | null;
  /** When the current job completes. `0` when idle. */
  busyUntil: number;
}

export interface QueueView {
  name: string;
  pending: number;
  running: number;
}

export interface Counters {
  enqueued: number;
  started: number;
  succeeded: number;
  failed: number;
  retried: number;
  deadLettered: number;
  dropped: number;
  rateLimited: number;
}

export interface EngineSnapshot {
  now: number;
  /** Live jobs only — pending, retrying, running. */
  jobs: Job[];
  workers: WorkerView[];
  queues: QueueView[];
  dlq: Job[];
  /**
   * Jobs that have just reached the dead-letter queue, kept briefly so a view
   * can animate them there instead of deleting them mid-journey. Presentation
   * only: they are already counted, already in `dlq`, and no longer live.
   */
  settling: Job[];
  counters: Counters;
}

export type EventName =
  | "enqueued"
  | "started"
  | "succeeded"
  | "failed"
  | "retry_scheduled"
  | "dead_lettered"
  | "rate_limited"
  | "dropped"
  | "worker_killed"
  | "cron_fired";

export interface EngineEvent {
  name: EventName;
  at: number;
  jobId?: string;
  task: string;
  /** Set on `retry_scheduled` — how long the job waits before its next attempt. */
  delayMs?: number;
  /** Set on `started`, `succeeded`, `failed`. */
  workerId?: number;
  attempt?: number;
}
