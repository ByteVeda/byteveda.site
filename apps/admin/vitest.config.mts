import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    // Unit tests only. Anything that needs a browser or a database belongs in
    // the Playwright suite, which runs against a built app.
    include: ["src/**/*.test.ts"],
  },
});
