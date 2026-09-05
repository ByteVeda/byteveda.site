import { expect, test } from "@playwright/test";

test.describe("home", () => {
  test("renders the pitch and every section", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    page.on("pageerror", (error) => errors.push(error.message));

    await page.goto("/");

    await expect(page.locator("h1")).toContainText("Delete Redis");
    for (const id of ["ledger", "lab", "interop", "source", "get-started"]) {
      await expect(page.locator(`#${id}`)).toBeAttached();
    }

    await expect(page.locator("#get-started").getByText("pip install flexiq")).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("the hero argues with a process list, not a fabricated terminal", async ({ page }) => {
    await page.goto("/");
    // The three daemons you stop running, struck out, and the one that stays.
    await expect(page.locator(".ps-gone")).toHaveCount(3);
    await expect(page.locator(".ps-kept")).toContainText("flexiq worker");
  });

  test("the SDK chosen in the hero follows through to the closing CTA", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Node.js" }).first().click();

    await expect(page.locator("#get-started")).toContainText("Node.js quickstart");
    await expect(
      page.locator('#get-started a[href*="/node/getting-started/quickstart"]'),
    ).toBeVisible();
  });

  test("docs links stay in the same tab", async ({ page }) => {
    // Docs are a sibling ByteVeda domain, not a third-party site. Only genuinely
    // external destinations (GitHub) are allowed to open a new tab.
    for (const path of ["/", "/playground", "/blog"]) {
      await page.goto(path);
      const docsLinks = page.locator('a[href*="docs.byteveda.org"]');
      expect(await docsLinks.count(), `${path} has docs links`).toBeGreaterThan(0);
      for (const link of await docsLinks.all()) {
        expect(
          await link.getAttribute("target"),
          `${path}: ${await link.getAttribute("href")}`,
        ).toBeNull();
      }
    }
  });

  test("the footer clears the fixed page texture", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() =>
      window.scrollTo({ top: 99_999, behavior: "instant" as ScrollBehavior }),
    );

    await expect(page.getByRole("contentinfo").getByText("MIT licensed")).toBeInViewport();

    // `toBeVisible` cannot catch this one: `body::before` is a fixed, opaque
    // texture at `z-index: 0`, so a statically positioned footer keeps its box
    // and its hit-testing while painting nothing at all. The invariant is that
    // the footer sits at or above that layer, the way `main` does.
    const layers = await page.evaluate(() => {
      const of = (el: Element | null) => {
        const s = getComputedStyle(el as Element);
        return { position: s.position, zIndex: s.zIndex };
      };
      return {
        footer: of(document.querySelector("footer.footer")),
        texture: getComputedStyle(document.body, "::before").zIndex,
      };
    });

    expect(layers.footer.position).not.toBe("static");
    expect(Number(layers.footer.zIndex)).toBeGreaterThanOrEqual(Number(layers.texture));
  });

  test("serves a static hero under prefers-reduced-motion", async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: "reduce" });
    const page = await context.newPage();
    await page.goto("/");

    await expect(page.locator("svg.hero-fx")).toBeAttached();
    // Reveals must not be left invisible when their animation is disabled.
    await expect(page.locator("#interop .interop-file").first()).toBeVisible();
    await context.close();
  });
});

test.describe("the failure lab", () => {
  test("each experiment reaches the outcome it claims", async ({ page }) => {
    await page.goto("/");

    // Exhausting the retry budget must actually dead-letter, not just fail.
    await page.getByRole("button", { name: "burn the retry budget" }).click();
    await expect(page.locator(".lab-counter.is-watched")).toContainText("Dead-lettered");
    await expect(page.locator(".lab-counter.is-watched b")).not.toHaveText("0", {
      timeout: 30_000,
    });

    // A flooded token bucket defers work rather than dropping it.
    await page.getByRole("button", { name: "flood a 5/s rate limit" }).click();
    await expect(page.locator(".lab-counter.is-watched")).toContainText("Rate limited");
    await expect(page.locator(".lab-counter.is-watched b")).not.toHaveText("0", {
      timeout: 30_000,
    });
  });

  test("killing a worker returns its job to the queue instead of losing it", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "kill -9 a worker" }).click();

    // The claim is an invariant, so assert the invariant rather than a log line:
    // all 20 jobs finish even though two workers are killed mid-flight, and none
    // of them spends a retry doing it — a reclaimed lease is not a failed task.
    // (Asserting on the event log would be flaky by construction: it keeps the
    // newest 40 events, and a burst this size pushes `worker_killed` out of the
    // window within a couple of seconds.)
    //
    // The generous timeout is about the clock, not the queue: the simulation is
    // driven by rAF, and a page competing with three other Playwright workers
    // gets far fewer frames per second than a foregrounded one.
    await expect(page.locator(".lab-counter", { hasText: "Succeeded" }).locator("b")).toHaveText(
      "20",
      { timeout: 60_000 },
    );
    await expect(page.locator(".lab-counter", { hasText: "Retried" }).locator("b")).toHaveText("0");
  });
});
