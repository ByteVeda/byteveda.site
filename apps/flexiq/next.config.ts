import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Workspace packages ship raw TypeScript, so Next has to compile them itself.
  transpilePackages: ["@byteveda/ui", "@byteveda/utils", "@byteveda/flexiq-sim"],
};

export default nextConfig;
