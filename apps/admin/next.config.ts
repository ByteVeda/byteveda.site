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
