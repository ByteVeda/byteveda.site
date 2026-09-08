import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
