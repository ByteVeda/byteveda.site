const { defineLighthouseConfig } = require("@byteveda/config/lighthouse/base");

const PORT = 3103;

module.exports = defineLighthouseConfig({
  // The shop and the request. /sample audits empty, which is the state a cold
  // visitor who follows a shared link actually lands in.
  routes: ["/", "/sample"],
  port: PORT,
  startServerCommand: `pnpm start --port ${PORT}`,
  // Measured on the first build, then given room. The inventory table and the
  // quote panel are client components, which is where the script budget goes.
  budget: {
    scriptBytes: 220_000,
    totalBytes: 420_000,
    fontBytes: 140_000,
    domSize: 1200,
  },
});
