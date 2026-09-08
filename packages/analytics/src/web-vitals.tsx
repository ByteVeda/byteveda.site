"use client";

import { usePathname } from "next/navigation";
import { useReportWebVitals } from "next/web-vitals";

/**
 * Field measurement for the three apps.
 *
 * Lighthouse describes one machine on one network; this describes the visitors.
 * Built on `next/web-vitals`, a framework API rather than a vendor SDK, so the
 * only thing tied to a provider is the endpoint the samples are posted to —
 * change `NEXT_PUBLIC_VITALS_ENDPOINT` and the reporting follows.
 *
 * With no endpoint configured the component is inert, which is what makes it
 * safe to mount in local development and in the static docs export.
 */

/** web-vitals buckets the Core Web Vitals; Next's own custom timings (hydration,
 *  route-change) arrive without a rating. */
type Rated = { rating?: "good" | "needs-improvement" | "poor" };

export type VitalsSample = {
  id: string;
  name: string;
  label: string;
  value: number;
  rating: Rated["rating"] | null;
  path: string;
  ts: number;
};

export type WebVitalsProps = {
  /** Defaults to `NEXT_PUBLIC_VITALS_ENDPOINT`. Nothing is sent when unset. */
  endpoint?: string;
  /** Escape hatch for a second sink — a console table in dev, a product analytics
   *  call, a store. Runs whether or not an endpoint is configured. */
  onReport?: (sample: VitalsSample) => void;
};

const DEFAULT_ENDPOINT = process.env.NEXT_PUBLIC_VITALS_ENDPOINT;

function send(endpoint: string, sample: VitalsSample) {
  const body = JSON.stringify(sample);

  // CLS and INP are reported as the page is going away, which is the one moment
  // a normal request is allowed to be cancelled. Beacon first, keepalive second.
  const beacon = navigator.sendBeacon?.(endpoint, new Blob([body], { type: "application/json" }));
  if (beacon) return;

  void fetch(endpoint, {
    body,
    method: "POST",
    keepalive: true,
    headers: { "content-type": "application/json" },
  }).catch(() => undefined);
}

export function WebVitals({ endpoint = DEFAULT_ENDPOINT, onReport }: WebVitalsProps) {
  const path = usePathname();

  useReportWebVitals((metric) => {
    const sample: VitalsSample = {
      id: metric.id,
      name: metric.name,
      label: metric.label,
      value: metric.value,
      rating: (metric as typeof metric & Rated).rating ?? null,
      path,
      ts: Date.now(),
    };

    onReport?.(sample);
    if (endpoint) send(endpoint, sample);
  });

  return null;
}
