"use client";

import type { EngineEvent } from "@byteveda/flexiq-sim";

const GLYPH: Record<EngineEvent["name"], string> = {
  enqueued: "+",
  started: "→",
  succeeded: "✓",
  failed: "✕",
  retry_scheduled: "↻",
  dead_lettered: "☠",
  rate_limited: "⏸",
  dropped: "⌫",
  worker_killed: "⚡",
  cron_fired: "⏱",
};

function describe(event: EngineEvent): string {
  switch (event.name) {
    case "retry_scheduled":
      return `${event.task} retry ${event.attempt} in ${Math.round((event.delayMs ?? 0) / 100) / 10}s`;
    case "worker_killed":
      return `worker ${event.workerId} went down`;
    case "rate_limited":
      return `${event.task} over its dispatch rate limit`;
    case "dead_lettered":
      return `${event.task} exhausted its retries`;
    case "cron_fired":
      return `${event.task} fired on schedule`;
    default:
      return `${event.task}${event.workerId === undefined ? "" : ` on worker ${event.workerId}`}`;
  }
}

export function EventLog({ events }: { events: EngineEvent[] }) {
  return (
    <div className="pg-panel">
      <div className="pg-panel-head">
        <h3>Events</h3>
        <span>newest first</span>
      </div>
      <ul className="pg-log">
        {events.map((event, index) => (
          <li key={`${event.at}-${event.name}-${event.jobId ?? index}`} data-event={event.name}>
            <span className="pg-glyph">{GLYPH[event.name]}</span>
            <span className="pg-at">{(event.at / 1000).toFixed(1)}s</span>
            <span className="pg-desc">{describe(event)}</span>
          </li>
        ))}
        {events.length === 0 && <li className="pg-empty">Nothing has happened yet.</li>}
      </ul>
    </div>
  );
}
