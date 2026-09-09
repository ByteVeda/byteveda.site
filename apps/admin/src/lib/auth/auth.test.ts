import { describe, expect, it } from "vitest";
import { isAllowed, parseAllowlist } from "./allowlist";
import { safeNext } from "./urls";

describe("parseAllowlist", () => {
  it("reads a comma-separated list, tolerating whitespace", () => {
    expect(parseAllowlist(" 67143288 , 12345 ")).toEqual([67143288, 12345]);
  });

  it("treats unset and empty as nobody", () => {
    expect(parseAllowlist(undefined)).toEqual([]);
    expect(parseAllowlist("")).toEqual([]);
    expect(parseAllowlist(" , ")).toEqual([]);
  });

  it("refuses a login where an id belongs, rather than silently ignoring it", () => {
    expect(() => parseAllowlist("kartikeya-27")).toThrow(/numeric GitHub user IDs/);
  });

  it("refuses values that are not positive integers", () => {
    expect(() => parseAllowlist("0")).toThrow();
    expect(() => parseAllowlist("-4")).toThrow();
    expect(() => parseAllowlist("1.5")).toThrow();
  });
});

describe("isAllowed", () => {
  it("admits an id on the list and refuses one that is not", () => {
    expect(isAllowed(67143288, [67143288, 1])).toBe(true);
    expect(isAllowed(999, [67143288, 1])).toBe(false);
  });

  it("refuses everyone when the list is empty", () => {
    expect(isAllowed(67143288, [])).toBe(false);
  });
});

describe("safeNext", () => {
  it("keeps an in-app path", () => {
    expect(safeNext("/posts/abc?tab=seo")).toBe("/posts/abc?tab=seo");
  });

  it("falls back to the dashboard when there is nothing to honour", () => {
    expect(safeNext(null)).toBe("/");
    expect(safeNext(undefined)).toBe("/");
    expect(safeNext("")).toBe("/");
  });

  it("refuses to bounce the operator off-site after login", () => {
    expect(safeNext("https://evil.example.com")).toBe("/");
    expect(safeNext("//evil.example.com")).toBe("/");
    expect(safeNext("/\\evil.example.com")).toBe("/");
    expect(safeNext("javascript:alert(1)")).toBe("/");
  });
});
