import { describe, expect, it } from "vitest";

import { type CustomRequest, describeRequest, quoteFor } from "./quote";

const base: CustomRequest = {
  board: "CBSE",
  cls: "10",
  subject: "Mathematics",
  chapter: "Trigonometry — heights and distances",
  questions: 30,
  difficulty: "board",
  answerKey: "steps",
  copies: 1,
};

describe("quoteFor", () => {
  it("adds setting, question blocks, difficulty and the answer key", () => {
    // 149 setting + 3 blocks x 22 + 40 board-level + 40 step-by-step
    expect(quoteFor(base).total).toBe(295);
  });

  it("charges a part-block of questions as a whole one", () => {
    expect(quoteFor({ ...base, questions: 21 }).total).toBe(
      quoteFor({ ...base, questions: 30 }).total,
    );
  });

  it("drops the surcharges that do not apply", () => {
    const quote = quoteFor({ ...base, difficulty: "practice", answerKey: "none" });
    expect(quote.total).toBe(215);
    expect(quote.lines.filter((line) => line.value === "included")).toHaveLength(2);
  });

  it("multiplies by the copy count", () => {
    expect(quoteFor({ ...base, copies: 10 }).total).toBe(2950);
  });

  it("applies the class-set rate from eleven copies", () => {
    expect(quoteFor({ ...base, copies: 10 }).classSet).toBe(false);

    const classSet = quoteFor({ ...base, copies: 12 });
    expect(classSet.classSet).toBe(true);
    expect(classSet.total).toBe(Math.round(295 * 12 * 0.7));
  });

  it("clamps the numbers the form can be pushed past", () => {
    expect(quoteFor({ ...base, questions: 1 }).questions).toBe(10);
    expect(quoteFor({ ...base, questions: 5000 }).questions).toBe(120);
    expect(quoteFor({ ...base, copies: 0 }).copies).toBe(1);
    expect(quoteFor({ ...base, copies: 900 }).copies).toBe(60);
  });

  it("falls back to the defaults for a value that is not a number", () => {
    const quote = quoteFor({ ...base, questions: Number.NaN, copies: Number.NaN });
    expect(quote.questions).toBe(30);
    expect(quote.copies).toBe(1);
  });
});

describe("describeRequest", () => {
  it("names the copy count only when there is more than one", () => {
    expect(describeRequest(base, quoteFor(base))).toBe(
      "CBSE · Class 10 · Mathematics · 30 questions · board-level",
    );

    const bulk = { ...base, copies: 12 };
    expect(describeRequest(bulk, quoteFor(bulk))).toContain("12 copies");
  });
});
