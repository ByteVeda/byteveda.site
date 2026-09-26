import { defineConfig } from "tsdown";

// Build for npm only; the monorepo's apps compile `src/` directly. Unbundled,
// so each `"use client"` banner stays on the one module it was written on
// instead of being hoisted onto (or dropped from) a shared chunk.
export default defineConfig({
  entry: ["src/**/*.{ts,tsx}"],
  unbundle: true,
  format: "esm",
  platform: "neutral",
  dts: true,
  // The mark stays a static import so the consumer's `next/image` sizes and
  // hashes it, exactly as it does for an app's own assets.
  deps: { neverBundle: [/\.png$/] },
  copy: [
    { from: "src/assets/**/*", to: "dist/assets" },
    { from: "src/styles/**/*", to: "dist/styles" },
  ],
});
