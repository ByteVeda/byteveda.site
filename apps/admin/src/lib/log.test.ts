import { describe, expect, it } from "vitest";
import { loggable } from "./log";

/** Built rather than typed, so this file contains no literal control character. */
const ESC = String.fromCharCode(27);
const BELL = String.fromCharCode(7);

describe("loggable", () => {
  it("leaves an ordinary value alone", () => {
    expect(loggable("b2f1c0de-0000-4000-8000-000000000001")).toBe(
      "b2f1c0de-0000-4000-8000-000000000001",
    );
  });

  it("refuses to let a value start a log entry of its own", () => {
    const forged = "real-id\nERROR [auth] admin session granted to attacker";

    expect(loggable(forged)).toBe("real-id ERROR [auth] admin session granted to attacker");
    expect(loggable(forged)).not.toContain("\n");
    expect(loggable("a\r\nb")).toBe("a  b");
  });

  it("strips the control characters a terminal would act on", () => {
    expect(loggable(`id${ESC}[2Kwiped${BELL}`)).toBe("id [2Kwiped ");
    expect(loggable("tab\tseparated")).toBe("tab separated");
  });

  it("bounds the length, so one value cannot flood the line", () => {
    expect(loggable("x".repeat(5000))).toHaveLength(200);
    expect(loggable("abcdef", 3)).toBe("abc");
  });

  it("accepts whatever it is given, since a caught error is rarely a string", () => {
    expect(loggable(new Error("boom"))).toBe("Error: boom");
    expect(loggable(null)).toBe("null");
    expect(loggable(undefined)).toBe("undefined");
    expect(loggable(42)).toBe("42");
  });

  it("keeps a format specifier as text — the caller never makes it the format", () => {
    expect(loggable("%s%d%o")).toBe("%s%d%o");
  });
});
