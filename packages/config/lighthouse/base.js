/**
 * Shared Lighthouse CI configuration for the ByteVeda apps.
 *
 * The audit target is a URL, never a host. `LHCI_TARGET_URL` overrides the
 * locally built production server, so pointing a run at a deployed preview is an
 * environment variable rather than a rewrite — the same override works for
 * Vercel, Netlify, Cloudflare or a box you own. With nothing set, the run builds
 * and serves the app itself and stays portable.
 *
 * Two tiers of assertion, deliberately:
 *
 *   error — byte weights and document shape. Identical on every run, so they can
 *           fail a pull request without turning CI into a coin toss.
 *   warn  — wall-clock metrics. Shared CI runners swing these ±30% between runs;
 *           they are reported for the trend, never used as a gate.
 */

const NUMBER_OF_RUNS = 3;

/** HTTP/2 and long-cache headers are the CDN's job, not the app's. Auditing them
 *  against a local `next start` only ever produces noise. */
const SKIP_AUDITS = ["uses-http2", "uses-long-cache-ttl", "canonical"];

const BASE_SETTINGS = {
  skipAudits: SKIP_AUDITS,
  chromeFlags: "--no-sandbox --disable-gpu --disable-dev-shm-usage",
};

/**
 * Headers sent with every request in the run.
 *
 * The admin console is the only caller: every page worth measuring there is
 * behind a session cookie, and without one Lighthouse measures the redirect to
 * the login page three times.
 */
function settingsFor(extraHeaders) {
  return extraHeaders ? { ...BASE_SETTINGS, extraHeaders } : BASE_SETTINGS;
}

/** Wall-clock ceilings, in ms except CLS. Warn-only — see the header. */
const DEFAULT_TIMING = {
  "largest-contentful-paint": 4000,
  "total-blocking-time": 600,
  "cumulative-layout-shift": 0.1,
  "speed-index": 5000,
};

function timingAssertions(timing) {
  const merged = { ...DEFAULT_TIMING, ...timing };
  return Object.fromEntries(
    Object.entries(merged).map(([audit, maxNumericValue]) => [
      audit,
      ["warn", { maxNumericValue }],
    ]),
  );
}

/**
 * Deterministic assertions. `resource-summary:*:size` is transfer size, so the
 * ceilings belong to the app rather than here — a page that lazy-loads a shader
 * and a static export of one document have nothing in common.
 */
function budgetAssertions({ scriptBytes, totalBytes, fontBytes, domSize = 1500 }) {
  return {
    "resource-summary:script:size": ["error", { maxNumericValue: scriptBytes }],
    "resource-summary:total:size": ["error", { maxNumericValue: totalBytes }],
    "resource-summary:font:size": ["error", { maxNumericValue: fontBytes }],
    "dom-size": ["error", { maxNumericValue: domSize }],

    // Real regressions, but the numeric value moves with Lighthouse's own
    // heuristics rather than with our diff, so they report instead of block.
    "unused-javascript": "warn",
    "render-blocking-resources": "warn",
    "uses-text-compression": "warn",
    "legacy-javascript": "warn",
    "third-party-summary": "warn",
  };
}

/**
 * Resolve where to point Chrome.
 *
 * `staticDistDir` is for `output: "export"` apps, which have no server to start.
 * A deployed target beats both — it measures the CDN the visitor actually hits.
 */
function collectFor({
  routes,
  port,
  startServerCommand,
  staticDistDir,
  staticFiles,
  extraHeaders,
}) {
  const target = process.env.LHCI_TARGET_URL?.replace(/\/+$/, "");
  const settings = settingsFor(extraHeaders);

  if (target) {
    return {
      url: routes.map((route) => `${target}${route}`),
      numberOfRuns: NUMBER_OF_RUNS,
      settings,
    };
  }

  if (staticDistDir) {
    return {
      staticDistDir,
      // Without this, Lighthouse walks the export and audits every file it finds,
      // including the 404 shells.
      url: staticFiles,
      numberOfRuns: NUMBER_OF_RUNS,
      settings,
    };
  }

  return {
    startServerCommand,
    url: routes.map((route) => `http://127.0.0.1:${port}${route}`),
    numberOfRuns: NUMBER_OF_RUNS,
    settings,
  };
}

/**
 * Build a complete `lighthouserc.js` export.
 *
 * @param {object} options
 * @param {string[]} options.routes            Paths appended to the audit target.
 * @param {number} [options.port]              Port for the locally started server.
 * @param {string} [options.startServerCommand] Omit for a static export.
 * @param {string} [options.staticDistDir]     Export directory, relative to the app.
 * @param {string[]} [options.staticFiles]     Files to audit inside that directory.
 * @param {object} options.budget              Byte and DOM ceilings — see budgetAssertions.
 * @param {object} [options.timing]            Overrides for the warn-only metrics.
 * @param {object} [options.extraHeaders]      Sent with every request; for auditing behind a login.
 */
function defineLighthouseConfig({
  routes,
  port,
  startServerCommand,
  staticDistDir,
  staticFiles,
  budget,
  timing,
  extraHeaders,
}) {
  return {
    ci: {
      collect: collectFor({
        routes,
        port,
        startServerCommand,
        staticDistDir,
        staticFiles,
        extraHeaders,
      }),
      assert: {
        // Three runs, and the middle one decides. A single unlucky run on a
        // noisy runner should not speak for the branch.
        aggregationMethod: "median",
        assertions: {
          ...budgetAssertions(budget),
          ...timingAssertions(timing),
        },
      },
      upload: {
        target: "temporary-public-storage",
      },
    },
  };
}

module.exports = { defineLighthouseConfig, DEFAULT_TIMING, NUMBER_OF_RUNS };
