import { describe, expect, it } from "vitest";
import { isValidSlug, slugify, uniqueSlug } from "./slug";

describe("slugify", () => {
  it("lowercases and joins words with single hyphens", () => {
    expect(slugify("Retries and the Dead Letter Queue")).toBe("retries-and-the-dead-letter-queue");
  });

  it("folds accents rather than dropping the letters", () => {
    expect(slugify("Café déjà vu")).toBe("cafe-deja-vu");
  });

  it("joins words across an apostrophe", () => {
    expect(slugify("Why you don't need a broker")).toBe("why-you-dont-need-a-broker");
  });

  it("collapses runs of punctuation and trims the ends", () => {
    expect(slugify("  ...Hello --- World!!  ")).toBe("hello-world");
  });

  it("never ends on a hyphen after truncation", () => {
    const slug = slugify(`${"a".repeat(58)} bbbb`);
    expect(slug.length).toBeLessThanOrEqual(60);
    expect(slug.endsWith("-")).toBe(false);
  });

  it("produces something the database constraint accepts", () => {
    for (const title of ["FlexiQ 2.0 — what's new?", "  ", "Ünïcôde  ✨ title"]) {
      const slug = slugify(title);
      if (slug) expect(isValidSlug(slug)).toBe(true);
    }
  });

  it("returns empty when there is nothing to slug", () => {
    expect(slugify("!!!")).toBe("");
  });
});

describe("isValidSlug", () => {
  it("accepts kebab-case and rejects everything else", () => {
    expect(isValidSlug("retries-and-the-dlq")).toBe(true);
    expect(isValidSlug("post2")).toBe(true);
    expect(isValidSlug("Retries")).toBe(false);
    expect(isValidSlug("double--hyphen")).toBe(false);
    expect(isValidSlug("-leading")).toBe(false);
    expect(isValidSlug("trailing-")).toBe(false);
    expect(isValidSlug("")).toBe(false);
  });
});

describe("uniqueSlug", () => {
  it("keeps the slug when it is free", () => {
    expect(uniqueSlug("retries", ["other"])).toBe("retries");
  });

  it("counts up until it finds a free one", () => {
    expect(uniqueSlug("retries", ["retries"])).toBe("retries-2");
    expect(uniqueSlug("retries", ["retries", "retries-2"])).toBe("retries-3");
  });

  it("stays within the length limit and valid while suffixing", () => {
    const long = "a".repeat(60);
    const slug = uniqueSlug(long, [long]);
    expect(slug.length).toBeLessThanOrEqual(60);
    expect(isValidSlug(slug)).toBe(true);
  });
});
