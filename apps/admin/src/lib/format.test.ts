import { describe, expect, it } from "vitest";
import { initial } from "./format";

describe("initial", () => {
  it("takes the first letter of a display name", () => {
    expect(initial("Ada Lovelace", "ada@example.test")).toBe("A");
  });

  it("falls through to the address when there is no name", () => {
    expect(initial(null, "ada@example.test")).toBe("A");
    expect(initial("   ", "ada@example.test")).toBe("A");
  });

  it("skips leading punctuation rather than drawing it", () => {
    expect(initial('"ada"', null)).toBe("A");
    expect(initial("<ada@example.test>", null)).toBe("A");
  });

  it("handles a name outside the Latin alphabet", () => {
    expect(initial("张伟", null)).toBe("张");
  });

  it("draws a bullet rather than an empty disc", () => {
    expect(initial(null, undefined, "")).toBe("•");
    expect(initial("!!!", null)).toBe("•");
  });
});
