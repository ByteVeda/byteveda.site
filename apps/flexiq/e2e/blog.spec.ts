import { expect, test } from "@playwright/test";

test.describe("blog", () => {
  test("lists posts and opens one", async ({ page }) => {
    await page.goto("/blog");
    await expect(page.locator(".post-card")).toHaveCount(2);

    await page.getByRole("link", { name: /Why FlexiQ has no broker/ }).click();
    await expect(page.locator("h1")).toContainText("Why FlexiQ has no broker");
    await expect(page.locator(".prose table")).toBeVisible();
    await expect(page.locator(".prose h2").first()).toBeVisible();
  });

  test("serves a feed, a sitemap and an OG image", async ({ request }) => {
    const feed = await request.get("/blog/rss.xml");
    expect(feed.status()).toBe(200);
    expect(await feed.text()).toContain("<title>FlexiQ — Blog</title>");

    const sitemap = await request.get("/sitemap.xml");
    expect(await sitemap.text()).toContain("/blog/why-no-broker");

    const og = await request.get("/opengraph-image");
    expect(og.headers()["content-type"]).toContain("image/png");
  });
});
