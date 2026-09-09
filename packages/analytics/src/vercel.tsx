"use client";

import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

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
