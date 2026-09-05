import type { EngineConfig } from "@byteveda/flexiq-sim";

export interface Preset {
  id: string;
  label: string;
  blurb: string;
  /** Jobs the "burst" control enqueues, and which task they go to. */
  burst: { task: string; count: number };
  config: EngineConfig;
}

const backoff = (baseMs: number, maxMs = 300_000) => ({ baseMs, maxMs, jitter: true });

export const PRESETS: Preset[] = [
  {
    id: "email-burst",
    label: "Email burst",
    blurb:
      "A signup spike hands thousands of sends to the queue at once, but the provider only accepts five a second. The limiter paces dispatch; nothing is dropped and nothing is lost.",
    burst: { task: "send_email", count: 60 },
    config: {
      seed: 7,
      workers: 6,
      poolKind: "thread",
      tasks: [
        {
          name: "send_email",
          queue: "emails",
          priority: 0,
          durationMs: [180, 520],
          failureRate: 0.06,
          maxRetries: 3,
          backoff: backoff(1000),
          rateLimit: { count: 5, perMs: 1000, onExcess: "defer" },
        },
      ],
    },
  },
  {
    id: "flaky-api",
    label: "Flaky third-party API",
    blurb:
      "The upstream is failing six calls in ten. Watch the backoff curve stretch — one second, two, four — and the jobs that burn through their retry budget land in the dead-letter queue instead of disappearing.",
    burst: { task: "fetch_profile", count: 24 },
    config: {
      seed: 11,
      workers: 4,
      poolKind: "thread",
      tasks: [
        {
          name: "fetch_profile",
          queue: "default",
          priority: 0,
          durationMs: [120, 400],
          failureRate: 0.6,
          maxRetries: 3,
          backoff: backoff(800, 30_000),
        },
      ],
    },
  },
  {
    id: "ml-batch",
    label: "ML inference batch",
    blurb:
      "Long CPU-bound jobs on a prefork pool. Four processes, no GIL to share, and a queue that stays honest about how much is still waiting.",
    burst: { task: "run_inference", count: 30 },
    config: {
      seed: 3,
      workers: 4,
      poolKind: "prefork",
      tasks: [
        {
          name: "run_inference",
          queue: "gpu",
          priority: 0,
          durationMs: [1400, 3600],
          failureRate: 0.03,
          maxRetries: 1,
          backoff: backoff(2000),
        },
      ],
    },
  },
  {
    id: "etl-priority",
    label: "ETL under priority",
    blurb:
      "Three stages sharing one pool. `extract` outranks the rest, so a late arrival still jumps the backlog — priority is per job, not per queue position.",
    burst: { task: "transform", count: 40 },
    config: {
      seed: 19,
      workers: 5,
      poolKind: "thread",
      tasks: [
        {
          name: "extract",
          queue: "etl",
          priority: 10,
          durationMs: [200, 500],
          failureRate: 0.02,
          maxRetries: 3,
          backoff: backoff(1000),
        },
        {
          name: "transform",
          queue: "etl",
          priority: 0,
          durationMs: [400, 900],
          failureRate: 0.05,
          maxRetries: 3,
          backoff: backoff(1000),
        },
        {
          name: "load",
          queue: "etl",
          priority: 5,
          durationMs: [300, 700],
          failureRate: 0.02,
          maxRetries: 3,
          backoff: backoff(1000),
        },
      ],
    },
  },
  {
    id: "cron-digest",
    label: "Cron digest",
    blurb:
      "A periodic task registered on a six-field cron. No beat daemon, no second process — the scheduler that dispatches ordinary jobs enqueues this one too.",
    burst: { task: "build_digest", count: 4 },
    config: {
      seed: 23,
      workers: 3,
      poolKind: "thread",
      tasks: [
        {
          name: "build_digest",
          queue: "reports",
          priority: 0,
          durationMs: [600, 1400],
          failureRate: 0.04,
          maxRetries: 2,
          backoff: backoff(1500),
          cron: "*/2 * * * * *",
        },
      ],
    },
  },
];

export const DEFAULT_PRESET = PRESETS[0];

export function findPreset(id: string): Preset | undefined {
  return PRESETS.find((p) => p.id === id);
}
