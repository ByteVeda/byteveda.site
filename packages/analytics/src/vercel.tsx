"use client";

import { SpeedInsights } from "@vercel/speed-insights/next";

/**
 * Vercel's sink, mounted only where it can work.
 *
 * `<SpeedInsights />` unconditionally injects `/_vercel/speed-insights/script.js`,
 * a path only Vercel's edge serves. Anywhere else — a local production build, a
 * CI browser run, a self-hosted deploy — that request 404s and leaves an error in
 * the console, which is both noise and a real assertion failure in the e2e suite.
 *
 * `NEXT_PUBLIC_VERCEL_ENV` is set by Vercel at build time and inlined here, so
 * the guard costs nothing at runtime. Deleting this file and its two imports is
 * the whole cost of leaving Vercel; `<WebVitals />` keeps reporting either way.
 */
export function VercelSpeedInsights() {
  if (!process.env.NEXT_PUBLIC_VERCEL_ENV) return null;
  return <SpeedInsights />;
}
