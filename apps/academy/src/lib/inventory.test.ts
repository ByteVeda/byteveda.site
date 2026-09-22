import { describe, expect, it } from "vitest";
import { MIX_TOTAL, PRICING } from "@/features/pricing";
import { chapters, describeContents, describeFree, listChapters, NO_FILTER } from "./inventory";

describe("the catalogue", () => {
  it("prices every chapter the same, stocked or not", () => {
    expect(new Set(chapters.map((c) => c.price))).toEqual(new Set([PRICING.chapter]));
  });

  it("puts the same mix in every chapter and the free questions on top", () => {
    for (const chapter of chapters) {
      const { easy, medium, hard, board, ncert } = chapter.counts;
      expect(easy + medium + hard).toBe(MIX_TOTAL);
      expect(chapter.questions).toBe(MIX_TOTAL + board + ncert);
    }
  });

  it("charges for the advanced block only where there is one to sell", () => {
    for (const chapter of chapters) {
      expect(chapter.advancedPrice).toBe(chapter.advanced > 0 ? PRICING.advanced : null);
    }
  });

  it("gives Class 9 no board questions and ICSE no NCERT exercise", () => {
    for (const chapter of chapters) {
      if (chapter.cls === "9") expect(chapter.counts.board).toBe(0);
      if (chapter.board === "ICSE") expect(chapter.counts.ncert).toBe(0);
    }
  });

  it("says what rides along free, and says nothing when nothing does", () => {
    const cbse = chapters.find((c) => c.board === "CBSE" && c.cls === "10");
    expect(cbse && describeFree(cbse)).toMatch(/\d+ board · \d+ NCERT/);
    expect(cbse && describeContents(cbse)).toContain("free");

    const bare = chapters.find((c) => c.counts.board === 0 && c.counts.ncert === 0);
    expect(bare && describeFree(bare)).toBeNull();
  });

  it("filters on every field the form exposes", () => {
    expect(listChapters(NO_FILTER)).toHaveLength(chapters.length);
    expect(listChapters({ ...NO_FILTER, board: "ICSE" }).every((c) => c.board === "ICSE")).toBe(
      true,
    );
    expect(listChapters({ ...NO_FILTER, query: "electricity" })).toHaveLength(1);
  });
});
