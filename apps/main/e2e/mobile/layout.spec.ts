import { auditMobileLayout } from "@byteveda/config/playwright/mobile-audit";
import { expect, test } from "@playwright/test";

const ROUTES = ["/", "/news", "/contribute"];

for (const path of ROUTES) {
  test(`${path} renders on a phone`, async ({ page }) => {
    await auditMobileLayout(page, path);
  });
}

test("the drawer carries navigation once the nav links are hidden", async ({ page }) => {
  await page.goto("/");

  // Below 940px `.nav-links` is display:none, so the drawer is the only way to
  // reach the rest of the site. If the button ever stops opening it, a phone
  // visitor is stranded on whatever page they landed on.
  await expect(page.locator(".nav-links")).toBeHidden();

  const drawer = page.getByRole("dialog", { name: "Menu" });
  await expect(drawer).not.toBeInViewport();

  await page.getByRole("button", { name: "Open menu" }).click();
  await expect(drawer).toBeInViewport();

  await drawer.getByRole("link", { name: "Contribute" }).click();
  await expect(page).toHaveURL(/\/contribute/);
  await expect(drawer).not.toBeInViewport();
});

test("tapping outside the drawer closes it and restores scrolling", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Open menu" }).click();

  // The drawer locks the body while open. Leaving that lock behind would make
  // the page look frozen after a dismissal — the worst kind of mobile bug,
  // because nothing on screen says why.
  await expect(page.locator("body")).toHaveCSS("overflow", "hidden");

  // Tapping the scrim is how a drawer gets dismissed on a phone; there is no
  // Escape key out there. The tap goes near the left edge on purpose — the
  // scrim spans the viewport, but the panel covers its centre.
  await page.locator(".drawer-scrim").click({ position: { x: 20, y: 200 } });
  await expect(page.getByRole("dialog", { name: "Menu" })).not.toBeInViewport();
  await expect(page.locator("body")).not.toHaveCSS("overflow", "hidden");
});
