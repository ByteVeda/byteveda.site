import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Workspace packages ship raw TypeScript, so Next has to compile them itself.
  transpilePackages: [
    "@byteveda/analytics",
    "@byteveda/db",
    "@byteveda/ui",
    "@byteveda/utils",
    "@byteveda/flexiq-sim",
  ],
  // node-postgres resolves its bindings at runtime, which a bundler cannot
  // follow. External keeps it a plain require on the server.
  serverExternalPackages: ["pg"],
};

export default nextConfig;
