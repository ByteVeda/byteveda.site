import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Workspace packages ship raw TypeScript, so Next has to compile them itself.
  transpilePackages: ["@byteveda/ui", "@byteveda/utils"],

  // Local-only (skip-worktree): let the dev server accept HMR / asset requests
  // proxied through ngrok tunnels. Do not commit.
  allowedDevOrigins: ["*.ngrok-free.app", "*.ngrok-free.dev", "*.ngrok.app", "*.ngrok.io"],
};

export default nextConfig;
