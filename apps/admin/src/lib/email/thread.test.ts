import { describe, expect, it } from "vitest";
import { displayName, normaliseEmail, normaliseSubject, threadKeyFor } from "./thread";

describe("normaliseSubject", () => {
  it("strips a reply prefix and folds whitespace and case", () => {
    expect(normaliseSubject("Re:  FlexiQ   retries")).toBe("flexiq retries");
  });

  it("strips stacked and localised prefixes", () => {
    expect(normaliseSubject("Re: Fwd: RE: A question")).toBe("a question");
    expect(normaliseSubject("AW: Eine Frage")).toBe("eine frage");
    expect(normaliseSubject("Re[2]: Threading")).toBe("threading");
  });

  it("leaves a subject that only looks like a prefix alone", () => {
    expect(normaliseSubject("Reasons FlexiQ is fast")).toBe("reasons flexiq is fast");
  });

  it("handles an empty subject", () => {
    expect(normaliseSubject("Re: ")).toBe("");
  });

  it("stays fast on the pathological input that made this quadratic", () => {
    // Anyone can email the inbound address, so the cost of a crafted subject
    // is a denial-of-service question rather than a style one.
    const started = performance.now();
    normaliseSubject(`re${" ".repeat(50_000)}: hello`);
    normaliseSubject(`${"Re: ".repeat(5_000)}hello`);
    expect(performance.now() - started).toBeLessThan(250);
  });

  it("caps an absurdly long subject rather than working through it", () => {
    expect(normaliseSubject("a".repeat(10_000)).length).toBeLessThanOrEqual(512);
  });
});

describe("normaliseEmail", () => {
  it("pulls the address out of a display-name form", () => {
    expect(normaliseEmail('"Ada Lovelace" <Ada@Example.TEST>')).toBe("ada@example.test");
  });

  it("passes a bare address through, lowercased", () => {
    expect(normaliseEmail("  Ada@Example.test ")).toBe("ada@example.test");
  });

  it("stays fast on a string of unclosed angle brackets", () => {
    const started = performance.now();
    normaliseEmail("<".repeat(50_000));
    normaliseEmail(`${"<=".repeat(50_000)}a@b.test`);
    expect(performance.now() - started).toBeLessThan(250);
  });
});

describe("displayName", () => {
  it("reads a quoted or unquoted name", () => {
    expect(displayName('"Ada Lovelace" <ada@example.test>')).toBe("Ada Lovelace");
    expect(displayName("Ada Lovelace <ada@example.test>")).toBe("Ada Lovelace");
  });

  it("is null when there is only an address", () => {
    expect(displayName("ada@example.test")).toBeNull();
  });
});

describe("threadKeyFor", () => {
  it("groups a reply with the message it answers", () => {
    const first = threadKeyFor("Ada <ada@example.test>", "FlexiQ retries");
    const reply = threadKeyFor("ada@example.TEST", "Re: FlexiQ retries");
    expect(reply).toBe(first);
  });

  it("keeps different correspondents apart on the same subject", () => {
    expect(threadKeyFor("ada@example.test", "Hello")).not.toBe(
      threadKeyFor("bob@example.test", "Hello"),
    );
  });

  it("keeps different subjects apart from the same correspondent", () => {
    expect(threadKeyFor("ada@example.test", "Hello")).not.toBe(
      threadKeyFor("ada@example.test", "Goodbye"),
    );
  });

  it("groups subjectless mail from one person rather than splitting every message", () => {
    expect(threadKeyFor("ada@example.test", "")).toBe(threadKeyFor("ada@example.test", "Re:"));
  });
});
