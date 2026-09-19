import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    // Unit tests only — pricing and the quote engine. Anything that needs a
    // browser belongs in the Playwright suite, which runs against a build.
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
});
