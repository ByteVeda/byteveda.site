import { describe, expect, it } from "vitest";

import { PRICING } from "./pricing";
import { type CustomRequest, describeRequest, quoteFor } from "./quote";

const base: CustomRequest = {
  board: "CBSE",
  cls: "10",
  subject: "Mathematics",
  chapter: "Trigonometry — heights and distances",
  advanced: false,
  copies: 1,
};

describe("quoteFor", () => {
  it("charges the setting once and the chapter per copy", () => {
    // 149 setting + 19 chapter
    expect(quoteFor(base).total).toBe(168);
  });

  it("adds the advanced block to every copy", () => {
    expect(quoteFor({ ...base, advanced: true }).total).toBe(188);
    expect(quoteFor({ ...base, advanced: true, copies: 3 }).total).toBe(149 + 39 * 3);
  });

  it("leaves the board questions, the NCERT exercise and the key free", () => {
    expect(quoteFor(base).lines.filter((line) => line.value === "free")).toHaveLength(1);
  });

  it("holds the mix fixed however the request is filled in", () => {
    expect(quoteFor(base).questions).toBe(50);
    expect(quoteFor({ ...base, advanced: true, copies: 20 }).questions).toBe(50);
  });

  it("multiplies the copies but never the setting", () => {
    expect(quoteFor({ ...base, copies: 10 }).total).toBe(PRICING.setting + PRICING.chapter * 10);
  });

  it("applies the class-set rate from eleven copies", () => {
    expect(quoteFor({ ...base, copies: 10 }).classSet).toBe(false);

    const classSet = quoteFor({ ...base, copies: 12 });
    expect(classSet.classSet).toBe(true);
    expect(classSet.total).toBe(
      PRICING.setting + Math.round(PRICING.chapter * 12 * PRICING.classSetRate),
    );
  });

  it("clamps the copy count the form can be pushed past", () => {
    expect(quoteFor({ ...base, copies: 0 }).copies).toBe(1);
    expect(quoteFor({ ...base, copies: 900 }).copies).toBe(60);
  });

  it("falls back to the default for a value that is not a number", () => {
    expect(quoteFor({ ...base, copies: Number.NaN }).copies).toBe(1);
  });
});

describe("describeRequest", () => {
  it("names the copy count only when there is more than one", () => {
    expect(describeRequest(base, quoteFor(base))).toBe(
      "CBSE · Class 10 · Mathematics · 50 questions · board and NCERT free",
    );

    const bulk = { ...base, copies: 12 };
    expect(describeRequest(bulk, quoteFor(bulk))).toContain("12 copies");
  });

  it("names the advanced block only when it was added", () => {
    expect(describeRequest(base, quoteFor(base))).not.toContain("advanced");

    const advanced = { ...base, advanced: true };
    expect(describeRequest(advanced, quoteFor(advanced))).toContain("advanced block");
  });
});
