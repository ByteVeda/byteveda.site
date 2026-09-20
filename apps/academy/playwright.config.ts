import { definePlaywrightConfig } from "@byteveda/config/playwright/base";

const PORT = 3014;

// The order flow is the product, and it only exists once the client bundle has
// hydrated — so the suite runs against the production build, desktop included.
export default definePlaywrightConfig({
  port: PORT,
  webServerCommand: `pnpm build && pnpm start --port ${PORT}`,
  desktop: true,
});
