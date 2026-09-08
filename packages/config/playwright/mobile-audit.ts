import { expect, type Page } from "@playwright/test";

/**
 * The mobile rendering audit shared by every ByteVeda app.
 *
 * These are the four failures a desktop suite structurally cannot see, asserted
 * as invariants rather than as pixels — no screenshot baselines to regenerate,
 * no font-rendering flake, and a failure message that names the element at
 * fault instead of pointing at a diff image.
 *
 *   1. the page does not scroll sideways
 *   2. anything you tap is big enough to hit with a thumb
 *   3. the page renders without console or runtime errors
 *   4. the first heading is on screen when the page opens
 */

/** Apple's Human Interface Guidelines floor for a touch target, in CSS pixels. */
const MIN_TAP_PX = 44;

/**
 * Controls and site chrome — the things a thumb goes for. Links that sit inside
 * running text or inside a card are exempted below rather than here: WCAG
 * exempts inline text links, and a card's own footer link is chrome for the
 * card, not for the page.
 */
const TAP_SELECTOR = [
  "button",
  "[role='button']",
  "input:not([type='hidden'])",
  "select",
  "textarea",
  "header a",
  "nav a",
  "footer a",
  "a[class*='btn']",
].join(", ");

type MobileReport = {
  scrollWidth: number;
  clientWidth: number;
  /** How far the viewport can actually be dragged sideways, in CSS pixels. */
  scrollableX: number;
  /** Elements whose removal alone brings the document back inside the viewport. */
  overflowing: string[];
  /** Tap targets below the floor, as `selector 30×30 — "label"`. */
  smallTapTargets: string[];
};

/**
 * One trip into the page for both measurements: they share the same element
 * describer, and splitting them would mean serialising it twice.
 */
function collect(page: Page, options: { minTap: number; tapSelector: string }) {
  return page.evaluate<MobileReport, { minTap: number; tapSelector: string }>(
    ({ minTap, tapSelector }) => {
      const doc = document.documentElement;
      const limit = doc.clientWidth;

      const describe = (el: Element) => {
        const id = el.id ? `#${el.id}` : "";
        const classes =
          typeof el.className === "string" && el.className.trim()
            ? `.${el.className.trim().split(/\s+/).join(".")}`
            : "";
        return `${el.tagName.toLowerCase()}${id}${classes}`;
      };

      const hidden = (el: Element) => {
        const style = getComputedStyle(el);
        if (style.visibility === "hidden" || style.display === "none") return true;
        if (style.pointerEvents === "none") return true;
        return !!el.closest('[aria-hidden="true"], [hidden], [inert]');
      };

      const pastEdge = (el: Element) => {
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0) return false;
        return rect.right > limit + 1;
      };

      // How far the page can really be dragged. A body that clips its overflow
      // still reports an oversized scrollWidth, and the difference between
      // "the page slides" and "the right edge is shaved off" is worth naming.
      const restore = window.scrollX;
      window.scrollTo(Number.MAX_SAFE_INTEGER, window.scrollY);
      const scrollableX = Math.round(window.scrollX);
      window.scrollTo(restore, window.scrollY);

      /**
       * Blame by elimination rather than by geometry. Every box sticking past the
       * edge is hidden in turn, and the ones that take the overflow with them are
       * the culprits — which sidesteps guessing at scroll containers, transformed
       * ancestors and the mobile viewport's habit of stretching fixed elements to
       * the overflow width.
       */
      const overflowing = [...document.body.querySelectorAll<HTMLElement>("*")]
        .filter(pastEdge)
        .slice(0, 60)
        .filter((el) => {
          const previous = el.style.display;
          el.style.display = "none";
          const without = doc.scrollWidth;
          el.style.display = previous;
          return without <= limit + 1;
        })
        .slice(0, 5)
        .map((el) => `${describe(el)} reaches ${Math.round(el.getBoundingClientRect().right)}px`);

      /** Inline links in prose, and links belonging to a card rather than to the
       *  page, are not thumb targets in the sense this audit is about. */
      const inRunningText = (el: Element) => !!el.closest("p, article, .prose");

      /**
       * A checkbox is deliberately small; the label wrapping it is what a thumb
       * lands on, and clicking that label toggles the box. So measure the label.
       */
      const hitArea = (el: Element) => {
        const boxed = el.matches("input[type='checkbox'], input[type='radio']");
        return (boxed ? (el.closest("label") ?? el) : el).getBoundingClientRect();
      };

      const smallTapTargets = [...document.querySelectorAll(tapSelector)]
        .filter((el) => !hidden(el) && !inRunningText(el))
        .filter((el) => {
          const rect = hitArea(el);
          return rect.width > 0 && rect.height > 0 && Math.min(rect.width, rect.height) < minTap;
        })
        .slice(0, 10)
        .map((el) => {
          const rect = hitArea(el);
          const label = el.getAttribute("aria-label") ?? el.textContent?.trim().slice(0, 40) ?? "";
          return `${describe(el)} ${Math.round(rect.width)}×${Math.round(rect.height)} — "${label}"`;
        });

      return {
        scrollWidth: doc.scrollWidth,
        clientWidth: limit,
        scrollableX,
        overflowing,
        smallTapTargets,
      };
    },
    options,
  );
}

/**
 * Load `path` on the current (phone-sized) context and assert it renders.
 *
 * Fonts are awaited first: metrics shift when the webfont swaps in, and a width
 * measured against the fallback face is a measurement of the wrong page.
 */
export type MobileAuditOptions = {
  /**
   * URLs allowed to answer 4xx/5xx — for routes that exist in production but not
   * in the artefact under test. Keep the list narrow and say why at the call site.
   */
  allowMissing?: RegExp[];
};

export async function auditMobileLayout(
  page: Page,
  path: string,
  { allowMissing = [] }: MobileAuditOptions = {},
) {
  const errors: string[] = [];
  page.on("console", (message) => {
    // The console's own line for a bad response says only "Failed to load
    // resource"; the `response` handler below is what names the URL.
    if (message.type() !== "error") return;
    if (message.text().startsWith("Failed to load resource")) return;
    errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("response", (response) => {
    if (response.status() < 400) return;
    if (allowMissing.some((pattern) => pattern.test(response.url()))) return;
    errors.push(`${response.status()} ${response.url()}`);
  });

  await page.goto(path);
  await page.evaluate(() => document.fonts.ready.then(() => undefined));

  // Doubles as the render gate: the assertion auto-waits, so everything measured
  // below is measured on a page that has actually painted its first screen.
  const heading = page.locator("h1, h2").first();
  await expect(heading, `${path}: no heading is on screen when the page opens`).toBeInViewport();

  const report = await collect(page, { minTap: MIN_TAP_PX, tapSelector: TAP_SELECTOR });

  const symptom = report.scrollableX
    ? `scrolls sideways by ${report.scrollableX}px`
    : "has content clipped at the right edge (the body hides the overflow rather than scrolling)";

  expect(
    report.scrollWidth,
    `${path} ${symptom}: ${report.scrollWidth}px of content in a ${report.clientWidth}px viewport.\n` +
      `Removing any of these alone fixes it:\n  ${report.overflowing.join("\n  ")}`,
  ).toBeLessThanOrEqual(report.clientWidth + 1);

  expect(
    report.smallTapTargets,
    `${path} has tap targets under ${MIN_TAP_PX}px:\n  ${report.smallTapTargets.join("\n  ")}`,
  ).toEqual([]);

  expect(errors, `${path} logged errors`).toEqual([]);
}
