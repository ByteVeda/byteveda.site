"use client";

import {
  createEngine,
  type Engine,
  type EngineConfig,
  type EngineEvent,
  type EngineSnapshot,
  type Job,
} from "@byteveda/flexiq-sim";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/** React repaints at this cadence; the canvas still draws every frame. */
const UI_INTERVAL_MS = 120;
const EVENT_LIMIT = 40;

/**
 * Last-resort bound on a single frame's delta — a long GC pause, a laptop waking
 * from sleep. It sits far above any real frame on purpose: the engine advances in
 * fixed 10 ms slices, so a large delta costs a little CPU and changes nothing
 * about the run, whereas clamping a merely slow frame silently drops simulated
 * time and puts the lab into slow motion on the devices least able to afford it.
 *
 * The one predictable source of an enormous delta — a backgrounded tab, where
 * rAF stops entirely — rebases the clock instead of being clamped. Scrolling the
 * lab out of view does not: frames keep arriving there, so no gap accumulates.
 */
const MAX_FRAME_MS = 1000;

export interface UseEngineOptions {
  /**
   * Work the scenario starts with. Applied to the freshly built engine and
   * again on every `reset`, so a board is never handed to the reader empty —
   * an idle queue is indistinguishable from a broken page.
   */
  seed?: (engine: Engine) => void;
}

export interface PlaygroundEngine {
  snapshot: EngineSnapshot | null;
  /** Finished jobs, newest first — the completed rows of the job table. */
  recent: Job[];
  events: EngineEvent[];
  running: boolean;
  speed: number;
  setRunning: (running: boolean) => void;
  setSpeed: (speed: number) => void;
  /** Registers a per-frame draw callback. Returns an unsubscribe function. */
  subscribe: (cb: (engine: Engine) => void) => () => void;
  /**
   * Pauses the clock while the playground is scrolled out of view. Bind this to
   * the playground *container*, never to the canvas: the controls, counters and
   * tables outlive the canvas on screen, and freezing them would look broken.
   */
  setVisible: (visible: boolean) => void;
  burst: (task: string, count: number) => void;
  killWorker: (id: number) => void;
  setFailureRate: (task: string, rate: number) => void;
  step: (ms?: number) => void;
  reset: () => void;
}

export function useEngine(config: EngineConfig, options: UseEngineOptions = {}): PlaygroundEngine {
  const [running, setRunning] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [snapshot, setSnapshot] = useState<EngineSnapshot | null>(null);
  const [events, setEvents] = useState<EngineEvent[]>([]);
  const [recent, setRecent] = useState<Job[]>([]);

  const engineRef = useRef<Engine | null>(null);
  const eventBuffer = useRef<EngineEvent[]>([]);
  const subscribers = useRef(new Set<(engine: Engine) => void>());
  const runningRef = useRef(running);
  const speedRef = useRef(speed);
  const visibleRef = useRef(true);
  /** Timestamp the next frame measures its delta against. Rebased, not clamped,
   *  whenever the clock has legitimately been stopped. */
  const lastFrameRef = useRef(0);
  /** Held in a ref, not an effect dependency: the seed changes with the chosen
   *  scenario, and reading the current one avoids rebuilding the engine twice. */
  const seedRef = useRef(options.seed);

  runningRef.current = running;
  speedRef.current = speed;
  seedRef.current = options.seed;

  // Rebuilding on config identity is deliberate: editing a parameter restarts
  // the scenario from a clean, reproducible state rather than mutating a run
  // half-way through, which would make a share link meaningless.
  useEffect(() => {
    const engine = createEngine(config);
    engineRef.current = engine;
    eventBuffer.current = [];
    const unsubscribe = engine.on("*", (event) => {
      eventBuffer.current.unshift(event);
      if (eventBuffer.current.length > EVENT_LIMIT) eventBuffer.current.length = EVENT_LIMIT;
    });

    // Seeded after the listener is attached, so the arrivals the scenario opens
    // with are logged like any others rather than happening off the record.
    seedRef.current?.(engine);
    setEvents([...eventBuffer.current]);
    setRecent([]);
    setSnapshot(engine.snapshot());

    return unsubscribe;
  }, [config]);

  useEffect(() => {
    let frame = 0;
    let uiAccumulator = 0;
    lastFrameRef.current = performance.now();

    const loop = (now: number) => {
      frame = requestAnimationFrame(loop);
      const dt = Math.min(MAX_FRAME_MS, now - lastFrameRef.current);
      lastFrameRef.current = now;

      const engine = engineRef.current;
      if (!engine) return;

      if (runningRef.current && visibleRef.current && !document.hidden) {
        engine.tick(dt * speedRef.current);
      }
      for (const cb of subscribers.current) cb(engine);

      uiAccumulator += dt;
      if (uiAccumulator >= UI_INTERVAL_MS) {
        uiAccumulator = 0;
        setSnapshot(engine.snapshot());
        setEvents([...eventBuffer.current]);
        setRecent(engine.recentJobs.slice(0, 12));
      }
    };

    // rAF stops while the tab is hidden, so the first frame back would otherwise
    // carry the whole absence. That time was not simulated and is not owed.
    const onVisibilityChange = () => {
      if (!document.hidden) lastFrameRef.current = performance.now();
    };

    frame = requestAnimationFrame(loop);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  const subscribe = useCallback((cb: (engine: Engine) => void) => {
    subscribers.current.add(cb);
    return () => {
      subscribers.current.delete(cb);
    };
  }, []);

  const setVisible = useCallback((visible: boolean) => {
    visibleRef.current = visible;
  }, []);

  const flush = useCallback(() => {
    const engine = engineRef.current;
    if (engine) setSnapshot(engine.snapshot());
  }, []);

  return useMemo<PlaygroundEngine>(
    () => ({
      snapshot,
      recent,
      events,
      running,
      speed,
      setRunning,
      setSpeed,
      subscribe,
      setVisible,
      burst: (task, count) => {
        engineRef.current?.enqueue(task, count);
        flush();
      },
      killWorker: (id) => {
        engineRef.current?.killWorker(id);
        flush();
      },
      setFailureRate: (task, rate) => {
        engineRef.current?.setFailureRate(task, rate);
      },
      step: (ms = 250) => {
        engineRef.current?.tick(ms);
        flush();
      },
      reset: () => {
        const engine = engineRef.current;
        if (!engine) return;
        engine.reset();
        eventBuffer.current = [];
        seedRef.current?.(engine);
        setEvents([...eventBuffer.current]);
        setRecent([]);
        flush();
      },
    }),
    [snapshot, recent, events, running, speed, subscribe, setVisible, flush],
  );
}
