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
 * A backgrounded tab hands back one enormous delta on return. Clamping it keeps
 * the simulation from replaying minutes of work in a single frame.
 */
const MAX_FRAME_MS = 250;

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

export function useEngine(config: EngineConfig): PlaygroundEngine {
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

  runningRef.current = running;
  speedRef.current = speed;

  // Rebuilding on config identity is deliberate: editing a parameter restarts
  // the scenario from a clean, reproducible state rather than mutating a run
  // half-way through, which would make a share link meaningless.
  useEffect(() => {
    const engine = createEngine(config);
    engineRef.current = engine;
    eventBuffer.current = [];
    setEvents([]);
    setRecent([]);
    setSnapshot(engine.snapshot());

    return engine.on("*", (event) => {
      eventBuffer.current.unshift(event);
      if (eventBuffer.current.length > EVENT_LIMIT) eventBuffer.current.length = EVENT_LIMIT;
    });
  }, [config]);

  useEffect(() => {
    let frame = 0;
    let last = performance.now();
    let uiAccumulator = 0;

    const loop = (now: number) => {
      frame = requestAnimationFrame(loop);
      const dt = Math.min(MAX_FRAME_MS, now - last);
      last = now;

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

    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
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
        engineRef.current?.reset();
        eventBuffer.current = [];
        setEvents([]);
        setRecent([]);
        flush();
      },
    }),
    [snapshot, recent, events, running, speed, subscribe, setVisible, flush],
  );
}
