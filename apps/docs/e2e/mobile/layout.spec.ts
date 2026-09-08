import { auditMobileLayout } from "@byteveda/config/playwright/mobile-audit";
import { projects } from "@byteveda/utils";
import { expect, test } from "@playwright/test";

// Every per-tool subpath is mirrored in from its own repo at deploy time, so the
// export under test has nothing to serve at /flexiq/ — and Next prefetches those
// links from the tool grid regardless. Their 404s here say nothing about the page.
const MIRRORED_TOOL_DOCS = [new RegExp(`/(${projects.map((p) => p.slug).join("|")})/$`)];

// Everything else under docs.byteveda.org comes from those same repos; the
// landing page is the only route this app owns.
test("/ renders on a phone", async ({ page }) => {
  await auditMobileLayout(page, "/", { allowMissing: MIRRORED_TOOL_DOCS });
});

test("the tools grid stacks instead of scrolling sideways", async ({ page }) => {
  await page.goto("/");

  // The grid is `md:grid-cols-2 lg:grid-cols-3`, so a phone should see exactly
  // one column. Asserting the cards share a left edge catches a card that
  // escapes its track — which reads as a half-visible neighbour, not as an
  // overflow the document reports.
  const cards = page.locator("#tools article");
  await expect(cards.first()).toBeVisible();

  const lefts = await cards.evaluateAll((nodes) =>
    nodes.map((node) => Math.round(node.getBoundingClientRect().left)),
  );
  expect(new Set(lefts).size).toBe(1);
});
