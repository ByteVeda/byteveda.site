import { auditMobileLayout } from "@byteveda/config/playwright/mobile-audit";
import { expect, test } from "@playwright/test";

for (const path of ["/", "/sample"]) {
  test(`${path} renders on a phone`, async ({ page }) => {
    await auditMobileLayout(page, path);
  });
}

test("picking a chapter still works at phone width", async ({ page }) => {
  await page.goto("/");

  // The inventory is a table, which is the control most likely to be
  // unreachable on a narrow screen. Picking from it is the whole product.
  await page
    .getByRole("button", { name: /^Pick / })
    .first()
    .click();
  await expect(page.locator(".sample-bar b")).toHaveText("Chemical Reactions and Equations");
});
