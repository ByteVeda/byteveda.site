import { auditMobileLayout } from "@byteveda/config/playwright/mobile-audit";
import { expect, test } from "@playwright/test";

const ROUTES = ["/", "/playground", "/blog", "/blog/why-no-broker"];

for (const path of ROUTES) {
  test(`${path} renders on a phone`, async ({ page }) => {
    await auditMobileLayout(page, path);
  });
}

test("the playground is still operable at phone width", async ({ page }) => {
  await page.goto("/playground");

  // The whole argument of the page is that you drive it yourself. A control
  // column that collapses into an unreachable strip on a phone loses that,
  // and the generic audit only proves nothing is clipped.
  await page.getByRole("button", { name: /^Burst \d+ jobs$/ }).click();
  await expect(page.locator(".pg-counter", { hasText: "Succeeded" }).locator("b")).not.toHaveText(
    "0",
    { timeout: 15_000 },
  );

  // The snippet is the takeaway; it has to survive the narrow column too.
  await expect(page.locator(".pg-code pre")).toBeVisible();
});
