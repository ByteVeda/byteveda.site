"use client";

import type { EngineConfig } from "@byteveda/flexiq-sim";
import { useReducedMotion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { DocsLink } from "@/components/docs-link";
import { docsUrl } from "@/lib/docs";
import { Stage } from "./canvas/stage";
import { CodePane } from "./code-pane";
import { Controls } from "./controls";
import { EventLog } from "./event-log";
import { JobTable } from "./job-table";
import { DEFAULT_PRESET, type Preset } from "./presets";
import { fromSearchParams, toSearchParams } from "./share";
import { useEngine } from "./use-engine";

const COUNTERS = [
  { key: "succeeded", label: "Succeeded" },
  { key: "failed", label: "Failed" },
  { key: "retried", label: "Retried" },
  { key: "deadLettered", label: "Dead-lettered" },
  { key: "rateLimited", label: "Rate limited" },
  { key: "dropped", label: "Dropped" },
] as const;

export function Playground() {
  const [preset, setPreset] = useState<Preset>(DEFAULT_PRESET);
  const [config, setConfig] = useState<EngineConfig>(DEFAULT_PRESET.config);
  const [shared, setShared] = useState(false);
  const engine = useEngine(config);
  const reducedMotion = useReducedMotion() ?? false;
  const rootRef = useRef<HTMLDivElement>(null);

  // The clock follows the whole playground, not the canvas: a visitor reading
  // the event log with the canvas scrolled off the top should still see it move.
  const { setVisible } = engine;
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), {
      rootMargin: "200px",
    });
    observer.observe(root);
    return () => observer.disconnect();
  }, [setVisible]);

  // Applied after mount rather than during render: the page is statically
  // prerendered, so reading `location` any earlier would desync hydration.
  useEffect(() => {
    if (!window.location.search) return;
    const state = fromSearchParams(window.location.search);
    setPreset(state.preset);
    setConfig(state.config);
  }, []);

  const choosePreset = useCallback((next: Preset) => {
    setPreset(next);
    setConfig(next.config);
  }, []);

  const share = useCallback(() => {
    const query = toSearchParams(preset, config);
    const url = `${window.location.origin}${window.location.pathname}?${query}`;
    window.history.replaceState(null, "", `?${query}`);
    navigator.clipboard?.writeText(url);
    setShared(true);
    setTimeout(() => setShared(false), 1600);
  }, [preset, config]);

  const snapshot = engine.snapshot;

  return (
    <div className="pg" ref={rootRef}>
      <div className="pg-main">
        <div className="pg-stage">
          <Stage subscribe={engine.subscribe} reducedMotion={reducedMotion} />
          <p className="pg-honesty">
            A simulation of FlexiQ&rsquo;s scheduling semantics, running in your browser — the
            priorities, backoff curve, rate limits and dead-letter rules are the documented ones.
            The real engine is Rust; see the{" "}
            <DocsLink href={docsUrl("architecture")}>architecture</DocsLink>.
          </p>
        </div>

        {snapshot && (
          <div className="pg-counters">
            {COUNTERS.map((counter) => (
              <div key={counter.key} className="pg-counter">
                <b>{snapshot.counters[counter.key]}</b>
                <span>{counter.label}</span>
              </div>
            ))}
          </div>
        )}

        <CodePane config={config} />

        {snapshot && (
          <div className="pg-panels">
            <JobTable snapshot={snapshot} recent={engine.recent} />
            <EventLog events={engine.events} />
          </div>
        )}
      </div>

      <aside className="pg-aside">
        <Controls
          preset={preset}
          config={config}
          engine={engine}
          onPreset={choosePreset}
          onConfig={setConfig}
          onShare={share}
          shared={shared}
        />
      </aside>
    </div>
  );
}
