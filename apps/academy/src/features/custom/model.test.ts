import { describe, expect, it } from "vitest";

import { PRICING } from "@/features/pricing";
import { type CustomRequest, describeRequest, quoteFor } from "./model";

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
    expect(quoteFor(base).total).toBe(PRICING.setting + PRICING.chapter);
  });

  it("adds the advanced block to every copy", () => {
    expect(quoteFor({ ...base, advanced: true }).total).toBe(
      PRICING.setting + PRICING.chapter + PRICING.advanced,
    );
    expect(quoteFor({ ...base, advanced: true, copies: 3 }).total).toBe(
      PRICING.setting + (PRICING.chapter + PRICING.advanced) * 3,
    );
  });

  it("gives a made-to-order chapter away for what the shelf charges", () => {
    expect(PRICING.setting).toBe(0);
    expect(quoteFor(base).total).toBe(PRICING.chapter);
  });

  it("leaves the board questions, the NCERT exercise, the key and the setting free", () => {
    // Two "free" lines now: the questions that ride along, and the labour.
    expect(quoteFor(base).lines.filter((line) => line.value === "free")).toHaveLength(2);
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
