import { describe, expect, it } from "vitest";
import {
  displayName,
  normaliseEmail,
  normaliseSubject,
  replyTargetOf,
  threadKeyFor,
} from "./model";

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

describe("replyTargetOf", () => {
  it("falls back to the sender when there is no Reply-To", () => {
    expect(replyTargetOf("Ada <ada@example.test>", null)).toEqual({
      email: "ada@example.test",
      name: "Ada",
    });
    expect(replyTargetOf("ada@example.test", {})).toEqual({
      email: "ada@example.test",
      name: null,
    });
  });

  it("answers the academy's work order to the student, not to the academy", () => {
    // The shape that made these unanswerable: the academy sends from its own
    // alias and puts the person waiting for the sheet in Reply-To.
    expect(
      replyTargetOf("ByteVeda Academy <academy@byteveda.org>", {
        "Reply-To": "student@example.test",
      }),
    ).toEqual({ email: "student@example.test", name: null });
  });

  it("matches the header whatever the sending server capitalised", () => {
    expect(replyTargetOf("a@example.test", { "reply-to": "b@example.test" }).email).toBe(
      "b@example.test",
    );
    expect(replyTargetOf("a@example.test", { "REPLY-TO": "b@example.test" }).email).toBe(
      "b@example.test",
    );
  });

  it("takes the display name from the Reply-To, not from the sender", () => {
    expect(
      replyTargetOf("ByteVeda Academy <academy@byteveda.org>", {
        "Reply-To": '"Ada Lovelace" <ada@example.test>',
      }),
    ).toEqual({ email: "ada@example.test", name: "Ada Lovelace" });
  });

  it("takes only the first of several, rather than fanning a reply out", () => {
    expect(
      replyTargetOf("a@example.test", { "Reply-To": "b@example.test, c@example.test" }).email,
    ).toBe("b@example.test");
  });

  it("ignores a Reply-To that is empty, malformed, or just the sender again", () => {
    expect(replyTargetOf("a@example.test", { "Reply-To": "" }).email).toBe("a@example.test");
    expect(replyTargetOf("a@example.test", { "Reply-To": "not-an-address" }).email).toBe(
      "a@example.test",
    );
    expect(replyTargetOf("a@example.test", { "Reply-To": "A@Example.TEST" }).email).toBe(
      "a@example.test",
    );
  });
});
