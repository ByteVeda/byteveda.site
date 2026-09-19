import { expect, test } from "@playwright/test";

const FIRST = "Chemical Reactions and Equations";
const FIRST_ID = "cbse-10-chemical-reactions-and-equations";

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

  test("holds one chapter at a time, and says so on every other row", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("button", { name: /^Pick / })).toHaveCount(6);
    await page
      .getByRole("button", { name: /^Pick / })
      .first()
      .click();
    await expect(page.locator(".sample-bar b")).toHaveText(FIRST);

    // One free sample per address, so the other five rows stop offering a
    // second one. Saying "Swap" is the only place that rule is visible before
    // somebody runs into it.
    await expect(page.getByRole("button", { name: /^Picked: / })).toHaveCount(1);
    await expect(page.getByRole("button", { name: /^Swap for / })).toHaveCount(5);
    await expect(page.getByRole("button", { name: /^Pick / })).toHaveCount(0);

    await page
      .getByRole("button", { name: /^Swap for / })
      .first()
      .click();
    await expect(page.locator(".sample-bar b")).not.toHaveText(FIRST);
    await expect(page.getByRole("button", { name: /^Picked: / })).toHaveCount(1);
    await expect(page.getByRole("link", { name: "Sample (1)" })).toBeVisible();
  });

  test("prices the sample at nothing, beside what the set would cost", async ({ page }) => {
    await page.goto("/");

    const row = page.locator(".table tbody tr").first();
    await expect(row.locator(".price-was")).toHaveText("₹129");
    await expect(row.locator(".price-free")).toHaveText("Free");
  });

  test("picking does not shuffle the table's columns", async ({ page }) => {
    await page.goto("/");

    const header = page.locator(".table thead th").nth(2);
    const before = await header.boundingBox();

    await page
      .getByRole("button", { name: /^Pick / })
      .first()
      .click();
    await expect(page.getByRole("button", { name: /^Picked: / })).toBeVisible();

    // "Pick", "Swap" and "Picked ✓" are three different lengths, and in an
    // auto-layout table the widest one drags every column sideways.
    const after = await header.boundingBox();
    expect(after?.x).toBeCloseTo(before?.x ?? -1, 0);
    expect(after?.width).toBeCloseTo(before?.width ?? -1, 0);
  });

  test("picking the same chapter again lets go of it", async ({ page }) => {
    await page.goto("/");

    await page
      .getByRole("button", { name: /^Pick / })
      .first()
      .click();
    await page.getByRole("button", { name: `Picked: ${FIRST}` }).click();

    await expect(page.locator(".sample-bar b")).toHaveText("Nothing picked yet");
    await expect(page.getByRole("link", { name: "Sample (0)" })).toBeVisible();
  });

  test("keeps the request off the landing page", async ({ page }) => {
    await page.goto("/");

    // The request is its own route now; the landing page only points at it.
    await expect(page.getByLabel("Email for the sample")).toHaveCount(0);
    await expect(page.locator(".sample-bar").getByRole("link")).toHaveAttribute("href", "/sample");
    await expect(page.getByRole("link", { name: "Sample (0)" })).toHaveAttribute("href", "/sample");
  });

  test("every full-bleed band lines up with the rest of the page", async ({ page }) => {
    await page.goto("/");

    // A band's rules run to the screen edges, and that is exactly how its
    // contents ended up a third of a screen out of line with every centred
    // section around them. The inventory is a plain `.wrap`, so its edges are
    // the page's column — everything else is measured against it.
    const drift = await page.evaluate(() => {
      const rect = (selector: string, from: ParentNode = document) => {
        const el = from.querySelector(selector);
        if (!el) throw new Error(`missing ${selector}`);
        return el.getBoundingClientRect();
      };
      const column = rect(".inventory-head");

      const bands = [...document.querySelectorAll(".band-inner")];
      if (bands.length !== 2) throw new Error(`expected 2 bands, found ${bands.length}`);

      return bands.flatMap((band) => {
        const first = band.firstElementChild?.getBoundingClientRect();
        const last = band.lastElementChild?.getBoundingClientRect();
        if (!first || !last) throw new Error("a band has no children");
        // The outer edge of the outermost child, less its own padding, is
        // where the words start.
        const pad = Number.parseFloat(getComputedStyle(band.children[0]).paddingLeft);
        return [first.left + pad - column.left, last.right - pad - column.right];
      });
    });

    for (const gap of drift) expect(Math.abs(gap)).toBeLessThanOrEqual(2);
  });

  test("says buying is coming soon where the total used to be", async ({ page }) => {
    await page.goto("/");

    // The bar is where the running total sat. Someone looking there for a price
    // has to find out why there isn't one, not just find nothing.
    await expect(page.locator(".inventory .soon")).toContainText("coming soon");
    await expect(page.locator(".inventory .soon")).toContainText("One free sample per email");
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
    await page
      .getByRole("button", { name: /^Pick / })
      .first()
      .click();
    await expect(page.getByRole("link", { name: "Sample (1)" })).toBeVisible();

    await page.locator(".sample-bar").getByRole("link").click();
    await expect(page).toHaveURL(/\/sample$/);
    await expect(page.locator("h1")).toHaveText("Request your sample.");
    await expect(page.getByRole("button", { name: /^Add an email to send$/ })).toBeDisabled();

    await page.getByLabel("Email for the sample").fill("student@example.com");
    await page.getByRole("button", { name: /^Request this sample$/ }).click();

    await expect(page.locator("h1")).toContainText("BVA-A1B2C3");
    await expect(page.locator(".placed")).toContainText("student@example.com");

    expect(sent).toEqual([
      { email: "student@example.com", items: [{ kind: "chapter", chapterId: FIRST_ID }] },
    ]);

    // The pick is spent once it has been filed.
    await page.getByRole("link", { name: /Back to the inventory/ }).click();
    await expect(page.getByRole("link", { name: "Sample (0)" })).toBeVisible();
  });

  test("asks for no money at all", async ({ page }) => {
    await page.goto("/");
    await page
      .getByRole("button", { name: /^Pick / })
      .first()
      .click();
    await page.locator(".sample-bar").getByRole("link").click();

    // The catalogue is a price list; this page is not. A rupee figure beside
    // something being given away reads as an invoice.
    await expect(page.locator(".sample-page")).not.toContainText("₹");
    await expect(page.locator(".soon")).toContainText("coming soon");
    await expect(page.getByRole("button", { name: /Pay/ })).toHaveCount(0);
  });

  test("says the sample is one per address", async ({ page }) => {
    await page.goto("/");
    await page
      .getByRole("button", { name: /^Pick / })
      .first()
      .click();
    await page.locator(".sample-bar").getByRole("link").click();

    await expect(page.locator(".sample-page")).toContainText("One free sample per address");
  });

  test("shows the one pick, with a way back to change it", async ({ page }) => {
    await page.goto("/");
    await page
      .getByRole("button", { name: /^Pick / })
      .first()
      .click();
    await page.locator(".sample-bar").getByRole("link").click();

    await expect(page.locator(".sample-line")).toHaveCount(1);
    await expect(page.locator(".sample-line b")).toHaveText(FIRST);
    await expect(page.getByRole("link", { name: "Change" })).toHaveAttribute("href", "/#inventory");
  });

  test("survives a reload", async ({ page }) => {
    await page.goto("/");
    await page
      .getByRole("button", { name: /^Pick / })
      .first()
      .click();
    await page.locator(".sample-bar").getByRole("link").click();

    await expect(page.locator(".sample-line")).toHaveCount(1);

    // A request on its own URL gets refreshed, bookmarked and reopened. A pick
    // held only in React state would be gone by the second visit.
    await page.reload();
    await expect(page.locator(".sample-line b")).toHaveText(FIRST);
    await expect(page.getByRole("link", { name: "Sample (1)" })).toBeVisible();
  });

  test("points an empty request back at the inventory", async ({ page }) => {
    await page.goto("/sample");

    await expect(page.locator("h1")).toHaveText("Request your sample.");
    await expect(page.locator(".placed")).toContainText("Nothing picked yet");
    await expect(page.getByRole("link", { name: /Browse the inventory/ })).toHaveAttribute(
      "href",
      "/#inventory",
    );
    await expect(page.getByRole("button", { name: /Request/ })).toHaveCount(0);
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

  test("refuses two samples in one POST, whatever the page does", async ({ request }) => {
    const two = await request.post("/api/orders", {
      data: {
        email: "student@example.com",
        items: [
          { kind: "chapter", chapterId: FIRST_ID },
          { kind: "chapter", chapterId: "cbse-10-life-processes" },
        ],
      },
    });

    expect(two.status()).toBe(400);
    expect(await two.json()).toMatchObject({ error: "One free sample per email address." });
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
    await expect(page.locator(".sample-bar b")).toHaveText("Heights and distances — made to order");

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
