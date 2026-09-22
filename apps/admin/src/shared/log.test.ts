import { describe, expect, it } from "vitest";
import { loggable } from "./log";

/** Built rather than typed, so this file contains no literal control character. */
const ESC = String.fromCharCode(27);

describe("loggable", () => {
  it("quotes an ordinary value, marking where it starts and ends", () => {
    expect(loggable("b2f1c0de-0000-4000-8000-000000000001")).toBe(
      '"b2f1c0de-0000-4000-8000-000000000001"',
    );
  });

  it("refuses to let a value start a log entry of its own", () => {
    const forged = "real-id\nERROR [auth] admin session granted to attacker";

    expect(loggable(forged)).not.toContain("\n");
    expect(loggable(forged)).toBe('"real-id\\nERROR [auth] admin session granted to attacker"');
    expect(loggable("a\r\nb")).toBe('"a\\r\\nb"');
  });

  it("escapes the control characters a terminal would act on", () => {
    expect(loggable(`id${ESC}[2Kwiped`)).toBe('"id\\u001b[2Kwiped"');
    expect(loggable("tab\tseparated")).toBe('"tab\\tseparated"');
  });

  it("escapes rather than strips, so the value still means what it said", () => {
    expect(JSON.parse(loggable("one\ntwo"))).toBe("one\ntwo");
  });

  it("bounds the length, so one value cannot flood the line", () => {
    // Two more than the content: the quotes JSON adds.
    expect(loggable("x".repeat(5000))).toHaveLength(502);
    expect(loggable("abcdef", 3)).toBe('"abc"');
  });

  it("keeps the stack of a caught error, on one line", () => {
    const logged = loggable(new Error("boom"));

    expect(logged).toContain("Error: boom");
    expect(logged).not.toContain("\n");
  });

  it("accepts whatever it is given, since a caught value is rarely an Error", () => {
    expect(loggable(null)).toBe('"null"');
    expect(loggable(undefined)).toBe('"undefined"');
    expect(loggable(42)).toBe('"42"');
  });

  it("keeps a format specifier as text — the caller never makes it the format", () => {
    expect(loggable("%s%d%o")).toBe('"%s%d%o"');
  });
});
