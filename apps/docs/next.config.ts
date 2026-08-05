import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  // Workspace packages ship raw TypeScript, so Next has to compile them itself.
  transpilePackages: ["@byteveda/utils"],
};

export default nextConfig;
