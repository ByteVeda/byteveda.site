"use client";

import { track as send } from "@vercel/analytics";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

/** What Vercel accepts as a custom event property. Flat on purpose. */
export type EventProperties = Record<string, string | number | boolean | null>;

/**
 * Vercel's sinks, mounted only where they can work.
 *
 * `<Analytics />` and `<SpeedInsights />` unconditionally inject
 * `/_vercel/insights/script.js` and `/_vercel/speed-insights/script.js`, paths
 * only Vercel's edge serves. Anywhere else — a local production build, a CI
 * browser run, a self-hosted deploy — those requests 404 and leave errors in the
 * console, which is both noise and a real assertion failure in the e2e suite.
 *
 * `NEXT_PUBLIC_VERCEL_ENV` is set by Vercel at build time and inlined here, so
 * the guard costs nothing at runtime. Deleting this file and its one import per
 * app is the whole cost of leaving Vercel; `<WebVitals />` keeps reporting
 * either way.
 */
export function VercelInsights() {
  if (!process.env.NEXT_PUBLIC_VERCEL_ENV) return null;

  return (
    <>
      <Analytics />
      <SpeedInsights />
    </>
  );
}

/**
 * One custom event, behind the same guard as the sinks above.
 *
 * Off Vercel there is no endpoint to receive it — `track` would queue the event
 * against a script that was never mounted — so this does nothing rather than
 * something invisible. That also keeps a local run and the e2e suite from
 * reporting a funnel nobody is watching.
 *
 * Properties are flat by Vercel's rule, not by ours: nested objects are dropped
 * on the way out, so a caller that wants a breakdown has to name each part.
 */
export function track(event: string, properties?: EventProperties): void {
  if (!process.env.NEXT_PUBLIC_VERCEL_ENV) return;

  send(event, properties);
}
