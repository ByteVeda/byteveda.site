import { expect, test } from "@playwright/test";

const counter = (page: import("@playwright/test").Page, label: string) =>
  page.locator(".pg-counter", { hasText: label }).locator("b");

test.describe("playground", () => {
  test("runs jobs to completion", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));

    await page.goto("/playground");
    await expect(page.locator("canvas.pg-canvas")).toBeVisible();

    await page.getByRole("button", { name: /^Burst \d+ jobs$/ }).click();
    await expect(counter(page, "Succeeded")).not.toHaveText("0", { timeout: 15_000 });
    await expect(page.locator(".pg-log li").first()).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("exhausted retries land in the dead-letter queue", async ({ page }) => {
    await page.goto("/playground");
    await page.getByRole("button", { name: "Flaky third-party API" }).click();
    await page.getByRole("button", { name: /^Burst \d+ jobs$/ }).click();
    await page.getByRole("button", { name: "4×" }).click();

    await expect(counter(page, "Dead-lettered")).not.toHaveText("0", { timeout: 30_000 });
    await expect(counter(page, "Retried")).not.toHaveText("0");
  });

  test("the generated snippet tracks the controls", async ({ page }) => {
    await page.goto("/playground");
    const code = page.locator(".pg-code pre");
    await expect(code).toContainText("max_retries=3");

    await page.getByRole("button", { name: "Node.js" }).click();
    await expect(code).toContainText("maxRetries: 3");
    await expect(code).toContainText('rateLimit: "5/s"');

    await page.getByRole("button", { name: "Java" }).click();
    await expect(code).toContainText("RetryPolicy.exponential");
  });

  test("a share link restores the scenario", async ({ page }) => {
    await page.goto("/playground");
    await page.getByRole("button", { name: "ML inference batch" }).click();
    await page.getByRole("button", { name: "Copy share link" }).click();

    await expect(page).toHaveURL(/[?&]p=ml-batch/);

    await page.reload();
    await expect(page.getByRole("button", { name: "ML inference batch" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  test("pause stops the clock", async ({ page }) => {
    await page.goto("/playground");
    await page.getByRole("button", { name: /^Burst \d+ jobs$/ }).click();
    await page.getByRole("button", { name: "Pause" }).click();

    // The counters repaint on a 120ms interval, so a job that finished just
    // before the click still lands in the DOM just after it. Let that last
    // flush through before sampling, or the baseline reads one job stale.
    await page.waitForTimeout(500);
    const started = await counter(page, "Succeeded").textContent();
    await page.waitForTimeout(1200);
    expect(await counter(page, "Succeeded").textContent()).toBe(started);
  });
});
