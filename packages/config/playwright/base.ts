import { defineConfig, devices } from "@playwright/test";

/**
 * Shared Playwright configuration for the ByteVeda apps.
 *
 * Specs are split by directory rather than by tag: anything under `e2e/mobile/`
 * runs on the two phone projects, everything else runs on desktop Chrome. A suite
 * that grows a desktop test does not silently triple its runtime on CI, and a
 * mobile test never has to guard itself with a viewport check.
 *
 * WebKit is not optional here. `dvh`, `backdrop-filter`, flex `gap` and sticky
 * positioning all behave differently on iOS Safari, and a Chromium-only run —
 * emulated phone or not — reports none of it.
 */

/** Phone specs live here; the desktop project is told to skip them. */
const MOBILE_SPECS = "**/mobile/**";

type PlaywrightOptions = {
  /** Port the app under test is served on. Unique per app so suites can run at once. */
  port: number;
  /** Built and started by Playwright — always the production build, never `next dev`. */
  webServerCommand: string;
  /** Apps whose `e2e/` holds desktop specs too. Mobile-only suites leave this off. */
  desktop?: boolean;
  /** Raise for apps whose production build is slow to come up. */
  webServerTimeout?: number;
};

export function definePlaywrightConfig({
  port,
  webServerCommand,
  desktop = false,
  webServerTimeout = 180_000,
}: PlaywrightOptions) {
  const baseURL = `http://127.0.0.1:${port}`;

  return defineConfig({
    testDir: "./e2e",
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 1 : 0,
    reporter: process.env.CI ? "github" : "list",
    use: {
      baseURL,
      trace: "on-first-retry",
    },
    projects: [
      ...(desktop
        ? [
            {
              name: "desktop",
              use: { ...devices["Desktop Chrome"] },
              testIgnore: MOBILE_SPECS,
            },
          ]
        : []),
      {
        name: "mobile-chrome",
        use: { ...devices["Pixel 7"] },
        testMatch: MOBILE_SPECS,
      },
      {
        name: "mobile-safari",
        use: { ...devices["iPhone 14"] },
        testMatch: MOBILE_SPECS,
      },
    ],
    webServer: {
      command: webServerCommand,
      url: baseURL,
      reuseExistingServer: !process.env.CI,
      timeout: webServerTimeout,
    },
  });
}
