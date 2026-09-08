import { definePlaywrightConfig } from "@byteveda/config/playwright/base";

const PORT = 3013;

// `output: "export"` leaves nothing to start, so the export is served statically —
// the same reason `lighthouserc.js` points Lighthouse at `out/` instead of a server.
export default definePlaywrightConfig({
  port: PORT,
  webServerCommand: `pnpm build && pnpm dlx serve@14 out --listen ${PORT} --no-clipboard --no-port-switching`,
});
