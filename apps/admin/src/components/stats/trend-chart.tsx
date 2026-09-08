"use client";

import { useId, useState } from "react";
import { count } from "@/lib/format";
import type { DailyTotal } from "@/lib/stats/queries";

type Props = { daily: DailyTotal[] };

/**
 * The viewBox is in the chart's own proportions and scales uniformly. A
 * narrow one stretched with `preserveAspectRatio="none"` would distort the
 * axis labels horizontally as the container grows.
 */
const WIDTH = 640;
const HEIGHT = 150;
const PAD = { top: 10, right: 8, bottom: 24, left: 46 };

/** Round the axis top to something a person would have chosen. */
function niceCeiling(value: number): number {
  if (value <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  return Math.ceil(value / magnitude) * magnitude;
}

function shortDay(day: string): string {
  // Locale pinned: this renders on the server too, and a runtime locale that
  // differs from the browser's is a hydration mismatch.
  return new Date(`${day}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

/**
 * Downloads a day across every package, for the last thirty.
 *
 * One series, so no legend and no categorical palette — the heading names it,
 * and the accent carries it. Gaps in the data break the line rather than
 * dropping it to zero.
 */
export function TrendChart({ daily }: Props) {
  const gradientId = useId();
  const [hover, setHover] = useState<number | null>(null);

  const recorded = daily.filter((point): point is { day: string; downloads: number } =>
    Number.isFinite(point.downloads as number),
  );

  if (recorded.length < 2) {
    return (
      <div className="trend-empty">
        Not enough history yet. Collect for a few days and the trend appears here.
      </div>
    );
  }

  // 0-based: a downloads chart that does not start at zero exaggerates change.
  const top = niceCeiling(Math.max(...recorded.map((point) => point.downloads)));
  const plotWidth = WIDTH - PAD.left - PAD.right;
  const plotHeight = HEIGHT - PAD.top - PAD.bottom;
  const step = plotWidth / (daily.length - 1);

  const xAt = (index: number) => PAD.left + index * step;
  const yAt = (value: number) => PAD.top + plotHeight - (value / top) * plotHeight;

  const segments: string[] = [];
  const areas: string[] = [];
  let line: string[] = [];
  let runStart = 0;

  const flush = (endIndex: number) => {
    if (line.length > 1) {
      segments.push(line.join(" "));
      areas.push(
        `${line.join(" ")} L${xAt(endIndex).toFixed(2)} ${yAt(0).toFixed(2)} L${xAt(runStart).toFixed(2)} ${yAt(0).toFixed(2)} Z`,
      );
    }
    line = [];
  };

  daily.forEach((point, index) => {
    if (point.downloads === null) {
      flush(index - 1);
      return;
    }
    if (line.length === 0) runStart = index;
    line.push(
      `${line.length === 0 ? "M" : "L"}${xAt(index).toFixed(2)} ${yAt(point.downloads).toFixed(2)}`,
    );
  });
  flush(daily.length - 1);

  const active = hover !== null ? daily[hover] : null;
  const gridValues = [0, top / 2, top];

  return (
    <figure className="trend">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label={`Downloads a day across every package for the last ${daily.length} days`}
        onMouseLeave={() => setHover(null)}
        onMouseMove={(event) => {
          const box = event.currentTarget.getBoundingClientRect();
          // The viewBox scales uniformly to the rendered width, so one ratio
          // converts a client x into viewBox units.
          const ratio = (event.clientX - box.left) / box.width;
          const index = Math.round((ratio * WIDTH - PAD.left) / step);
          setHover(index >= 0 && index < daily.length ? index : null);
        }}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.22" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {gridValues.map((value) => (
          <g key={value}>
            <line
              className="trend-grid"
              x1={PAD.left}
              x2={WIDTH - PAD.right}
              y1={yAt(value)}
              y2={yAt(value)}
              vectorEffect="non-scaling-stroke"
            />
            <text className="trend-tick" x={PAD.left - 4} y={yAt(value) + 3} textAnchor="end">
              {count(Math.round(value))}
            </text>
          </g>
        ))}

        {areas.map((area) => (
          <path key={area} d={area} fill={`url(#${gradientId})`} />
        ))}
        {segments.map((segment) => (
          <path
            key={segment}
            className="trend-line"
            d={segment}
            fill="none"
            vectorEffect="non-scaling-stroke"
          />
        ))}

        {hover !== null && active?.downloads !== null && active && (
          <g>
            <line
              className="trend-cursor"
              x1={xAt(hover)}
              x2={xAt(hover)}
              y1={PAD.top}
              y2={PAD.top + plotHeight}
              vectorEffect="non-scaling-stroke"
            />
            <circle className="trend-dot" cx={xAt(hover)} cy={yAt(active.downloads)} r={2} />
          </g>
        )}

        <text className="trend-tick" x={PAD.left} y={HEIGHT - 6} textAnchor="start">
          {shortDay(daily[0].day)}
        </text>
        <text className="trend-tick" x={WIDTH - PAD.right} y={HEIGHT - 6} textAnchor="end">
          {shortDay(daily[daily.length - 1].day)}
        </text>
      </svg>

      {/* Read out rather than floated, so it cannot cover the line it describes. */}
      <figcaption className="trend-readout">
        {active && active.downloads !== null ? (
          <>
            <b>{count(active.downloads)}</b> on {shortDay(active.day)}
          </>
        ) : (
          <span>Hover the chart for a day.</span>
        )}
      </figcaption>
    </figure>
  );
}
