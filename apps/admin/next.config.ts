import type { NextConfig } from "next";

/**
 * TEMPORARY — ngrok tunnelling for local testing.
 *
 * The dev server rejects cross-origin requests it was not told about, and a
 * tunnel is exactly that. Dev-only: `allowedDevOrigins` is ignored by
 * `next build`, so nothing here reaches production. Delete this block, and the
 * matching one in `api/public/subscribe/route.ts`, once the tunnel is no longer
 * needed.
 */
const NGROK_DEV_ORIGINS = [
  "*.ngrok-free.app",
  "*.ngrok-free.dev",
  "*.ngrok.app",
  "*.ngrok.io",
  "*.ngrok.dev",
];

const nextConfig: NextConfig = {
  allowedDevOrigins: NGROK_DEV_ORIGINS,
  /**
   * Both of these stop the client router re-fetching what it already has.
   *
   * The rail is seven links to seven dynamic routes, and it is on the screen
   * for the whole session — so anything that re-prefetches costs seven server
   * renders, each of which reads Postgres. In one eight-minute window of
   * production logs, one operator sitting still on one page produced eleven
   * renders of `/inbox`.
   *
   * `optimisticRouting` defaults to true from Next 16.3.0 and is the regression
   * behind vercel/next.js#97135, where the prefetch scheduler livelocks, and
   * #85489, which the Next team confirmed as links prefetching more than once
   * on 16 — its reporter watched Vercel invocations more than double on
   * upgrade. #97329 is the shape that shows up in DevTools as a request stuck
   * on `(pending)` forever: a prefetch whose response never settles the cache
   * entry that asked for it.
   *
   * `staleTimes.dynamic` defaults to 0, which means a prefetch of a dynamic
   * route is stale the instant it lands and the next render may ask again.
   * Thirty seconds is long enough that a rail link is fetched once per visit
   * and short enough that a page arrived at by clicking is never half a minute
   * out of date — and every one of these pages has a live stream or a server
   * action behind it that refreshes on the events that actually matter.
   *
   * Both are here because of upstream bugs. Re-test them when Next updates.
   */
  experimental: {
    optimisticRouting: false,
    staleTimes: { dynamic: 30 },
  },
  // Workspace packages ship raw TypeScript, so Next has to compile them itself.
  transpilePackages: ["@byteveda/db", "@byteveda/ui", "@byteveda/utils"],
  // node-postgres resolves its native bindings at runtime, which a bundler
  // cannot follow. Leaving it external keeps it a plain require on the server.
  serverExternalPackages: ["pg"],
  // Nothing here is for the public web, and nothing links in from outside.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "same-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
