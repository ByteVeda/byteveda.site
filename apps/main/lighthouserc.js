const { defineLighthouseConfig } = require("@byteveda/config/lighthouse/base");

const PORT = 3100;

module.exports = defineLighthouseConfig({
  // The three pages a visitor actually lands on. /news is the heaviest — it
  // renders the whole fetched feed — so it is the one worth watching.
  routes: ["/", "/news", "/contribute"],
  port: PORT,
  startServerCommand: `pnpm start --port ${PORT}`,
  // Measured, then given room: script 153KB, total 349KB, font 127KB, DOM 587.
  // Identical across three runs, which is what makes these safe to fail a PR on.
  budget: {
    scriptBytes: 190_000,
    totalBytes: 420_000,
    fontBytes: 140_000,
    domSize: 900,
  },
});
