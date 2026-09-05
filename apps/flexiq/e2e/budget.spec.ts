import { expect, test } from "@playwright/test";

/**
 * The hero is the first thing a visitor from a social post sees, so the shader
 * must stay off the critical path. This asserts the shape of the budget, not a
 * wall-clock number, which would be flaky on shared CI hardware.
 */
test("the WebGL chunk is not part of the initial payload", async ({ page }) => {
  const initialScripts: number[] = [];
  page.on("response", async (response) => {
    if (response.request().resourceType() !== "script") return;
    if (!response.url().includes("/_next/static/")) return;
    const length = Number(response.headers()["content-length"] ?? 0);
    if (length) initialScripts.push(length);
  });

  await page.goto("/", { waitUntil: "domcontentloaded" });
  const total = initialScripts.reduce((sum, size) => sum + size, 0);

  // three.js alone is far larger than this; a regression that statically
  // imports it would blow straight through the ceiling.
  expect(total).toBeLessThan(700_000);
});
