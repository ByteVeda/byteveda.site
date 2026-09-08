const { defineLighthouseConfig } = require("@byteveda/config/lighthouse/base");

module.exports = defineLighthouseConfig({
  // `output: "export"` leaves nothing to start, so Lighthouse serves `out/`
  // itself. Only the landing page is this app's — everything else under
  // docs.byteveda.org is mirrored in from the tool repos at deploy time.
  staticDistDir: "out",
  staticFiles: ["index.html"],
  // Used only when LHCI_TARGET_URL points the run at a deployed origin.
  routes: ["/"],
  // Measured, then given room: script 146KB, total 313KB, font 127KB, DOM 248.
  budget: {
    scriptBytes: 180_000,
    totalBytes: 380_000,
    fontBytes: 140_000,
    domSize: 600,
  },
});
