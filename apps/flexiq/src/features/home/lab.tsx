"use client";

import type { EngineConfig, TaskConfig } from "@byteveda/flexiq-sim";
import { cn } from "@byteveda/utils";
import { useReducedMotion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Code } from "@/components/code";
import { DocsLink } from "@/components/docs-link";
import { EXPERIMENTS, type Experiment } from "@/content/pitch";
import { Stage } from "@/features/playground/canvas/stage";
import { EventLog } from "@/features/playground/event-log";
import { useEngine } from "@/features/playground/use-engine";
import { docsUrl, type Sdk, sdkDocsUrl } from "@/lib/docs";
import { useSdk } from "./sdk-context";

/**
 * The failure lab — the page's centrepiece and the reason it is not a brochure.
 *
 * Every task queue's landing page demonstrates the happy path, which is the
 * part nobody doubts. The questions that actually decide adoption are about
 * failure: what happens to the job when the worker dies, what a retry storm
 * does to a downstream that is already struggling, whether the queue drops
 * work when it is over its limit. So those are the only four things this
 * section shows, and the reader triggers each one themselves.
 *
 * The behaviour is a simulation of FlexiQ's documented semantics, not the Rust
 * core in a WASM sandbox, and the section says so out loud rather than letting
 * the reader assume otherwise.
 */

/** Jobs that must be running before a scene's disruption fires. */
const DISRUPT_AFTER_STARTED = 4;

const backoff = (baseMs: number, maxMs: number) => ({ baseMs, maxMs, jitter: true });

const task = (over: Partial<TaskConfig> & { name: string }): TaskConfig => ({
  queue: "default",
  priority: 0,
  durationMs: [200, 600],
  failureRate: 0,
  maxRetries: 3,
  backoff: backoff(1000, 300_000),
  ...over,
});

interface Scene {
  config: EngineConfig;
  /** Jobs to enqueue as soon as the engine is built for this experiment. */
  burst: { task: string; count: number };
  /** Applied a beat later, once there is something in flight worth disturbing. */
  disrupt?: (engine: LabEngine) => void;
  /** The counter worth watching for this experiment. */
  watch: CounterKey;
}

type LabEngine = ReturnType<typeof useEngine>;

const COUNTERS = [
  { key: "succeeded", label: "Succeeded" },
  { key: "retried", label: "Retried" },
  { key: "deadLettered", label: "Dead-lettered" },
  { key: "rateLimited", label: "Rate limited" },
  { key: "dropped", label: "Dropped" },
] as const;

type CounterKey = (typeof COUNTERS)[number]["key"];

const SCENES: Record<string, Scene> = {
  kill: {
    config: {
      seed: 21,
      workers: 6,
      poolKind: "thread",
      tasks: [task({ name: "resize_image", durationMs: [600, 1200] })],
    },
    burst: { task: "resize_image", count: 20 },
    disrupt: (engine) => {
      engine.killWorker(0);
      engine.killWorker(3);
    },
    watch: "succeeded",
  },
  fail: {
    config: {
      seed: 5,
      workers: 4,
      poolKind: "thread",
      tasks: [
        task({
          name: "fetch_profile",
          durationMs: [140, 420],
          failureRate: 0.8,
          // Three retries rather than five, on a shorter base: with a 0.8
          // failure rate roughly four jobs in ten exhaust the budget, and they
          // do it inside a couple of seconds. At `max_retries=5` and a 1s base
          // the first dead letter is twelve seconds away, which is longer than
          // anyone watches a section of a landing page.
          maxRetries: 3,
          backoff: backoff(600, 10_000),
        }),
      ],
    },
    burst: { task: "fetch_profile", count: 24 },
    watch: "retried",
  },
  flood: {
    config: {
      seed: 13,
      workers: 6,
      poolKind: "thread",
      tasks: [
        task({
          name: "send_email",
          queue: "emails",
          durationMs: [180, 480],
          failureRate: 0.02,
          rateLimit: { count: 5, perMs: 1000, onExcess: "defer" },
        }),
      ],
    },
    burst: { task: "send_email", count: 120 },
    watch: "rateLimited",
  },
  dlq: {
    config: {
      seed: 9,
      workers: 4,
      poolKind: "thread",
      tasks: [
        task({
          name: "charge_card",
          durationMs: [140, 360],
          failureRate: 1,
          maxRetries: 3,
          backoff: backoff(500, 8000),
        }),
      ],
    },
    burst: { task: "charge_card", count: 12 },
    watch: "deadLettered",
  },
};

export function Lab() {
  const [active, setActive] = useState<Experiment>(EXPERIMENTS[0]);
  const [runs, setRuns] = useState(0);
  const { sdk } = useSdk();
  const labRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(true);

  // The clock is gated here, on the whole lab, and never on the canvas. The
  // buttons, counters and event log all outlive the canvas on screen, and a
  // reader who scrolls down to read the event log would otherwise freeze the
  // very thing they are reading. (This is the same trap the playground fell
  // into: gate drawing on the canvas, gate the clock on the container.)
  useEffect(() => {
    const root = labRef.current;
    if (!root) return;
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), {
      rootMargin: "400px",
    });
    observer.observe(root);
    return () => observer.disconnect();
  }, []);

  return (
    <section className="section-pad section-soft" id="lab">
      <div className="wrap">
        <div className="section-head">
          <p className="kicker">The lab</p>
          <h2>Everything works until it doesn&rsquo;t. Break this one.</h2>
          <p>
            The happy path is not the part you are unsure about. Kill a worker mid-job, fail four
            calls in five, flood a rate limit, exhaust a retry budget — and watch what the queue
            does about it. Pick one.
          </p>
        </div>

        <div className="lab" ref={labRef}>
          <ul className="lab-actions" aria-label="Failure experiments">
            {EXPERIMENTS.map((experiment) => (
              <li key={experiment.id}>
                <button
                  type="button"
                  className={cn("lab-action", experiment.id === active.id && "is-active")}
                  aria-pressed={experiment.id === active.id}
                  onClick={() => {
                    setActive(experiment);
                    setRuns(0);
                  }}
                >
                  <span className="lab-action-cmd">{experiment.action}</span>
                  <span className="lab-action-q">{experiment.question}</span>
                </button>
              </li>
            ))}
          </ul>

          {/* Remounting on the key is the reset: a new engine, a clean DLQ and
              the scene set up again, without an effect that has to guess when
              the previous run is over. */}
          <Run
            key={`${active.id}:${runs}`}
            experiment={active}
            sdk={sdk}
            visible={visible}
            onReplay={() => setRuns((n) => n + 1)}
          />
        </div>

        <p className="lab-honesty">
          This is a simulation of FlexiQ&rsquo;s documented behaviour running in your browser — the
          backoff curve, the token bucket and the dispatch order are ported from the core, and the
          numbers above are real outputs of that model. It is not the Rust core compiled to WASM,
          and it is not a benchmark. The{" "}
          <DocsLink href={docsUrl("architecture/overview")}>architecture</DocsLink> is where the
          real thing is written down.
        </p>
      </div>
    </section>
  );
}

interface RunProps {
  experiment: Experiment;
  sdk: Sdk;
  /** Whether the lab as a whole is on screen; the simulation clock follows it. */
  visible: boolean;
  onReplay: () => void;
}

/**
 * One run of one experiment. Mounted under a key that changes whenever the
 * reader picks a different experiment or replays this one, so every run starts
 * from a fresh engine rather than inheriting the last one's counters.
 */
function Run({ experiment, sdk, visible, onReplay }: RunProps) {
  const scene = SCENES[experiment.id];
  const reducedMotion = useReducedMotion() ?? false;

  // Cloned on mount: `useEngine` rebuilds on config identity, and the scene
  // table is module-level state that must not be mutated by a run.
  const config = useMemo<EngineConfig>(
    () => ({ ...scene.config, tasks: scene.config.tasks.map((t) => ({ ...t })) }),
    [scene],
  );

  const engine = useEngine(config);
  const engineRef = useRef(engine);
  engineRef.current = engine;

  const { setVisible } = engine;
  useEffect(() => {
    setVisible(visible);
  }, [setVisible, visible]);

  // Runs after `useEngine`'s own effect has built the engine, because that hook
  // is called earlier in this component's body.
  useEffect(() => {
    engineRef.current.burst(scene.burst.task, scene.burst.count);
    const { disrupt } = scene;
    if (!disrupt) return;

    // Fired off the simulation's own progress, not a wall-clock timer. The
    // clock advances with animation frames, so on a throttled tab a timer can
    // land before any job has started — and killing an idle worker proves
    // nothing. Waiting for jobs to be in flight makes the disruption land in
    // the same place on every device.
    let done = false;
    const unsubscribe = engineRef.current.subscribe((engine) => {
      if (done || engine.snapshot().counters.started < DISRUPT_AFTER_STARTED) return;
      done = true;
      disrupt(engineRef.current);
      unsubscribe();
    });
    return unsubscribe;
  }, [scene]);

  const counters = engine.snapshot?.counters;

  return (
    <>
      <div className="lab-stage">
        <div className="lab-canvas">
          <Stage subscribe={engine.subscribe} reducedMotion={reducedMotion} />
          <button type="button" className="lab-replay" onClick={onReplay}>
            Run it again
          </button>
        </div>

        <ul className="lab-counters">
          {COUNTERS.map((counter) => (
            <li
              key={counter.key}
              className={cn("lab-counter", counter.key === scene.watch && "is-watched")}
            >
              <b>{counters?.[counter.key] ?? 0}</b>
              <span>{counter.label}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="lab-read">
        <div className="lab-answer">
          <p className="lab-q">{experiment.question}</p>
          <p className="lab-invariant">{experiment.invariant}</p>
          <DocsLink className="lab-link" href={sdkDocsUrl(sdk, experiment.href)}>
            Read how it works →
          </DocsLink>
        </div>

        <div className="pane lab-code">
          <div className="pane-bar">
            <span className="dots">
              <i />
              <i />
              <i />
            </span>
            <span>tasks.py — the configuration that does it</span>
          </div>
          <Code code={experiment.code} lang="python" />
        </div>

        <EventLog events={engine.events} />
      </div>
    </>
  );
}
