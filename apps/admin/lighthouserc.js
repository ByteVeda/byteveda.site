const { defineLighthouseConfig } = require("@byteveda/config/lighthouse/base");

const PORT = 3102;

/**
 * Auditing a console that is entirely behind a login.
 *
 * `/login` is the only page an anonymous Chrome can reach, so that is the
 * default run — and it is worth watching on its own, since it is the one page
 * here a cold visitor waits on.
 *
 * Everything else needs a session. Export `ADMIN_SESSION_COOKIE` with the value
 * of the `bv_admin_session` cookie from a signed-in browser and the run covers
 * the three pages that actually get used. Without it those routes would redirect
 * and Lighthouse would measure the login page three more times.
 *
 *   ADMIN_SESSION_COOKIE=… pnpm --filter @byteveda/admin lighthouse
 */
const session = process.env.ADMIN_SESSION_COOKIE;

const ROUTES = session ? ["/login", "/", "/inbox", "/posts"] : ["/login"];

module.exports = defineLighthouseConfig({
  routes: ROUTES,
  port: PORT,
  startServerCommand: `pnpm start --port ${PORT}`,
  extraHeaders: session ? { Cookie: `bv_admin_session=${session}` } : undefined,
  // Measured across all four routes, then given room: the heaviest is /inbox at
  // script 153KB, total 258KB, font 77KB, DOM 130. Identical across three runs.
  // The console is a desktop tool behind a login, so these are here to catch a
  // dependency that doubles the bundle rather than to police a few KB.
  budget: {
    scriptBytes: 190_000,
    totalBytes: 320_000,
    fontBytes: 100_000,
    domSize: 300,
  },
});
