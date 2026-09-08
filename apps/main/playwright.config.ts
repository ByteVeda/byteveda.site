import { definePlaywrightConfig } from "@byteveda/config/playwright/base";

const PORT = 3012;

// Mobile-only suite: this app has no desktop specs, and the production build is
// what ships, so it is what gets measured.
export default definePlaywrightConfig({
  port: PORT,
  webServerCommand: `pnpm build && pnpm start --port ${PORT}`,
});
