import { expect, test } from "@playwright/test";

test.describe("the counter", () => {
  test("is stocked before anything is clicked", async ({ page }) => {
    await page.goto("/");

    // Nothing here is behind an interaction: the first paint has to show a
    // real catalogue with real prices, or the page reads as broken.
    await expect(page.locator(".table tbody tr")).toHaveCount(6);
    await expect(page.locator(".table tbody tr").first()).toContainText("₹");
    await expect(page.locator(".result-count")).toContainText("36 chapters");
    await expect(page.locator(".sample-bar b")).toHaveText("Nothing picked yet");
  });

  test("filters narrow the catalogue", async ({ page }) => {
    await page.goto("/");

    await page.getByRole("radio", { name: "ICSE" }).check();
    await expect(page.locator(".result-count")).toContainText("10 chapters");

    await page.getByRole("searchbox").fill("quadratic");
    await expect(page.locator(".result-count")).toContainText("1 chapter ");
    await expect(page.locator(".table tbody tr")).toHaveCount(1);
  });

  test("says nothing is stocked rather than showing an empty table", async ({ page }) => {
    await page.goto("/");

    await page.getByRole("searchbox").fill("astrophysics");
    await expect(page.locator(".empty-state h3")).toBeVisible();
    await expect(page.locator(".table")).toHaveCount(0);
  });

  test("keeps the request off the landing page", async ({ page }) => {
    await page.goto("/");

    // The request is its own route now; the landing page only points at it.
    await expect(page.getByLabel("Email for the samples")).toHaveCount(0);
    await expect(page.locator(".sample-bar").getByRole("link")).toHaveAttribute("href", "/sample");
    await expect(page.getByRole("link", { name: "Samples (0)" })).toHaveAttribute(
      "href",
      "/sample",
    );
  });

  test("says buying is coming soon where the total used to be", async ({ page }) => {
    await page.goto("/");

    // The bar is where the running total sat. Someone looking there for a price
    // has to find out why there isn't one, not just find nothing.
    await expect(page.locator(".inventory .soon")).toContainText("coming soon");
    await expect(page.getByRole("button", { name: /Pay|Buy|Checkout/i })).toHaveCount(0);
  });
});

test.describe("/sample", () => {
  test("sends what was asked for, and never a price", async ({ page }) => {
    const sent: unknown[] = [];

    await page.route("**/api/orders", async (route) => {
      sent.push(route.request().postDataJSON());
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ reference: "BVA-A1B2C3" }),
      });
    });

    await page.goto("/");
    await page.getByRole("button", { name: "Add", exact: true }).first().click();
    await expect(page.getByRole("link", { name: "Samples (1)" })).toBeVisible();

    await page.locator(".sample-bar").getByRole("link").click();
    await expect(page).toHaveURL(/\/sample$/);
    await expect(page.locator("h1")).toHaveText("Request samples.");
    await expect(page.getByRole("button", { name: /^Add an email to send$/ })).toBeDisabled();

    await page.getByLabel("Email for the samples").fill("student@example.com");
    await page.getByRole("button", { name: /^Request this sample$/ }).click();

    await expect(page.locator("h1")).toContainText("BVA-A1B2C3");
    await expect(page.locator(".placed")).toContainText("student@example.com");

    expect(sent).toEqual([
      {
        email: "student@example.com",
        items: [{ kind: "chapter", chapterId: "cbse-10-chemical-reactions-and-equations" }],
      },
    ]);

    // The list empties once it has been filed.
    await page.getByRole("link", { name: /Back to the inventory/ }).click();
    await expect(page.getByRole("link", { name: "Samples (0)" })).toBeVisible();
  });

  test("asks for no money at all", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Add", exact: true }).first().click();
    await page.locator(".sample-bar").getByRole("link").click();

    // The catalogue is a price list; this page is not. A rupee figure beside
    // something being given away reads as an invoice.
    await expect(page.locator(".sample-page")).not.toContainText("₹");
    await expect(page.locator(".soon")).toContainText("coming soon");
    await expect(page.getByRole("button", { name: /Pay/ })).toHaveCount(0);
  });

  test("survives a reload", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Add", exact: true }).first().click();
    await page.locator(".sample-bar").getByRole("link").click();

    await expect(page.locator(".sample-line")).toHaveCount(1);

    // A request on its own URL gets refreshed, bookmarked and reopened. A list
    // held only in React state would be gone by the second visit.
    await page.reload();
    await expect(page.locator(".sample-line")).toHaveCount(1);
    await expect(page.locator(".sample-line b")).toContainText("Chemical Reactions");
    await expect(page.getByRole("link", { name: "Samples (1)" })).toBeVisible();
  });

  test("points an empty request back at the inventory", async ({ page }) => {
    await page.goto("/sample");

    await expect(page.locator("h1")).toHaveText("Request samples.");
    await expect(page.locator(".placed")).toContainText("Nothing picked yet");
    await expect(page.getByRole("link", { name: /Browse the inventory/ })).toHaveAttribute(
      "href",
      "/#inventory",
    );
    await expect(page.getByRole("button", { name: /Request/ })).toHaveCount(0);
  });

  test("removing the last line falls back to the empty state", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Add", exact: true }).first().click();
    await page.locator(".sample-bar").getByRole("link").click();

    await page.getByRole("button", { name: /^Remove / }).click();
    await expect(page.locator(".placed")).toContainText("Nothing picked yet");
  });

  test("rejects a malformed request at the API", async ({ request }) => {
    const missingEmail = await request.post("/api/orders", { data: { items: [] } });
    expect(missingEmail.status()).toBe(400);
    expect(await missingEmail.json()).toMatchObject({ error: expect.any(String) });

    const notJson = await request.post("/api/orders", {
      headers: { "content-type": "application/json" },
      data: "{",
    });
    expect(notJson.status()).toBe(400);
  });
});

test.describe("the custom request", () => {
  test("re-prices as the form is filled in", async ({ page }) => {
    await page.goto("/");

    const quote = page.locator(".quote");
    await expect(quote.locator(".quote-total b")).toHaveText("₹295");
    await expect(quote.getByRole("button")).toBeDisabled();

    await page.getByLabel("Chapter or topic").fill("Heights and distances");
    await page.getByLabel("Copies").fill("12");

    // 295 a copy, twelve copies, less the 30% class-set rate.
    await expect(quote.locator(".quote-total b")).toHaveText("₹2478");
    await expect(quote).toContainText("class-set rate");

    await quote.getByRole("button", { name: /Ask for a sample of this/ }).click();
    await expect(page.locator(".sample-bar b")).toHaveText("1 chapter picked");

    await page.locator(".sample-bar").getByRole("link").click();
    await expect(page.locator(".sample-line")).toContainText(
      "Heights and distances — made to order",
    );
    // The quote stays on the landing page, where it is a quote rather than a bill.
    await expect(page.locator(".sample-page")).not.toContainText("2478");
  });

  test("picks a difficulty through the custom listbox", async ({ page }) => {
    await page.goto("/");

    const difficulty = page.getByRole("combobox", { name: "Difficulty" });
    await expect(difficulty).toContainText("Board-level mixed");

    await difficulty.click();
    await page.getByRole("option", { name: "Advanced / HOTS" }).click();

    await expect(difficulty).toContainText("Advanced / HOTS");
    // 149 setting + 66 questions + 80 advanced + 40 solutions.
    await expect(page.locator(".quote-total b")).toHaveText("₹335");
  });
});
