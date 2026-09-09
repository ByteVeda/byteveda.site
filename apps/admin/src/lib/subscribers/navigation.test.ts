import { describe, expect, it } from "vitest";
import { isDirectNavigation, readFetchMetadata } from "./navigation";

const meta = (headers: Record<string, string>) => readFetchMetadata(new Headers(headers));

describe("isDirectNavigation", () => {
  it("accepts a real click, which is a top-level document navigation", () => {
    expect(
      isDirectNavigation(meta({ "sec-fetch-mode": "navigate", "sec-fetch-dest": "document" })),
    ).toBe(true);
  });

  it("rejects a prefetch however it announces itself", () => {
    expect(isDirectNavigation(meta({ purpose: "prefetch" }))).toBe(false);
    expect(isDirectNavigation(meta({ "x-purpose": "Prefetch" }))).toBe(false);
    expect(isDirectNavigation(meta({ "x-moz": "prefetch" }))).toBe(false);
  });

  it("rejects a background fetch, which is what a scanner does", () => {
    expect(isDirectNavigation(meta({ "sec-fetch-mode": "cors", "sec-fetch-dest": "empty" }))).toBe(
      false,
    );
    expect(isDirectNavigation(meta({ "sec-fetch-mode": "no-cors" }))).toBe(false);
  });

  it("rejects a navigation aimed at something other than a document", () => {
    expect(
      isDirectNavigation(meta({ "sec-fetch-mode": "navigate", "sec-fetch-dest": "iframe" })),
    ).toBe(false);
  });

  it("accepts a request with no fetch metadata rather than breaking a real link", () => {
    expect(isDirectNavigation(meta({}))).toBe(true);
  });
});
