const { defineLighthouseConfig } = require("@byteveda/config/lighthouse/base");

const PORT = 3102;

module.exports = defineLighthouseConfig({
  routes: ["/", "/playground", "/blog"],
  port: PORT,
  startServerCommand: `pnpm start --port ${PORT}`,
  // Measured, then given room: script 232KB, total 411KB, font 76KB, DOM 507.
  // The hero's shader is a lazy chunk, so three.js is not in that script figure —
  // a static import would push it past this ceiling immediately, which is the
  // regression e2e/budget.spec.ts guards from the other side.
  budget: {
    scriptBytes: 290_000,
    totalBytes: 500_000,
    fontBytes: 90_000,
    domSize: 900,
  },
});
