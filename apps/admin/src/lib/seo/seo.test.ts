import { describe, expect, it } from "vitest";
import { type AuditInput, auditPost, auditScore } from "./audit";
import { extractKeywords, phrases, toRuns } from "./keywords";
import { firstParagraph, headings, isInternalLink, links, stripMarkup, wordCount } from "./text";

const POST = `---
title: Retries and the dead-letter queue
---

FlexiQ retries a failed task with exponential backoff until the retry budget is
spent, and then moves it to the dead-letter queue. See [the docs](/flexiq/retries).

## How the retry budget works

Every task carries a retry budget. The retry budget is decremented on each
failure, and a task queue that never gives up is a task queue that never drains.

\`\`\`python
queue.enqueue(job, retries=5)
\`\`\`

### Dead-letter queue

The dead-letter queue holds tasks whose retry budget is spent.
`;

describe("stripMarkup", () => {
  it("removes fenced code so its identifiers are not counted as prose", () => {
    expect(stripMarkup("text\n```py\nqueue.enqueue(job)\n```\nmore")).toBe("text more");
  });

  it("removes inline code, JSX, and comments", () => {
    expect(stripMarkup("a `code` b <Note x={1} /> c <!-- hi --> d")).toBe("a b c d");
  });

  it("keeps link text but discards the target", () => {
    expect(stripMarkup("see [the docs](/flexiq/retries) now")).toBe("see the docs now");
  });

  it("discards image alt text along with the image", () => {
    expect(stripMarkup("before ![a diagram](/x.png) after")).toBe("before after");
  });

  it("drops heading, quote, list, and emphasis markers", () => {
    expect(stripMarkup("## Title\n> quote\n- item\n**bold**")).toBe("Title quote item bold");
  });
});

describe("headings", () => {
  it("reads level and text, ignoring anything inside code", () => {
    expect(headings(POST)).toEqual([
      { level: 2, text: "How the retry budget works" },
      { level: 3, text: "Dead-letter queue" },
    ]);
  });
});

describe("links and isInternalLink", () => {
  it("collects link targets but not images", () => {
    expect(links("[a](/one) ![img](/two.png) [b](https://x.test/three)")).toEqual([
      "/one",
      "https://x.test/three",
    ]);
  });

  it("counts site-relative and byteveda.org targets as internal", () => {
    expect(isInternalLink("/blog/x")).toBe(true);
    expect(isInternalLink("https://flexiq.byteveda.org/blog/x")).toBe(true);
    expect(isInternalLink("https://example.com")).toBe(false);
    expect(isInternalLink("#section")).toBe(false);
  });
});

describe("firstParagraph", () => {
  it("skips frontmatter and returns the first real prose block", () => {
    expect(firstParagraph(POST)).toMatch(/^FlexiQ retries a failed task/);
  });

  it("is empty when there is no prose", () => {
    expect(firstParagraph("# Just a heading")).toBe("");
  });
});

describe("wordCount", () => {
  it("counts prose only", () => {
    expect(wordCount("one two three")).toBe(3);
    expect(wordCount("one two\n```\nignored code here\n```")).toBe(2);
    expect(wordCount("")).toBe(0);
  });
});

describe("toRuns", () => {
  it("breaks phrases at stopwords so they cannot span unrelated words", () => {
    expect(toRuns("retry budget is decremented on each failure")).toEqual([
      ["retry", "budget"],
      ["decremented"],
      ["failure"],
    ]);
  });

  it("keeps internal hyphens and drops bare numbers", () => {
    expect(toRuns("dead-letter queue 42")).toEqual([["dead-letter", "queue"]]);
  });
});

describe("phrases", () => {
  it("builds 1..3-word phrases inside a run and never across runs", () => {
    expect(phrases([["a", "b"], ["c"]])).toEqual(["a", "b", "a b", "c"]);
  });
});

describe("extractKeywords", () => {
  const keywords = extractKeywords({ title: "Retries and the dead-letter queue", body: POST });
  const terms = keywords.map((candidate) => candidate.term);

  it("finds the phrase the post is actually about", () => {
    expect(terms).toContain("retry budget");
  });

  it("ranks a title phrase above an incidental one", () => {
    const budget = keywords.findIndex((c) => c.term === "retry budget");
    const decremented = keywords.findIndex((c) => c.term === "decremented");
    expect(budget).toBeGreaterThanOrEqual(0);
    expect(decremented === -1 || budget < decremented).toBe(true);
  });

  it("never offers a stopword or a term from a code block", () => {
    expect(terms).not.toContain("the");
    expect(terms).not.toContain("enqueue");
  });

  it("drops a single word already covered by a better phrase", () => {
    expect(terms).toContain("dead-letter queue");
    expect(terms).not.toContain("letter");
  });

  it("marks where a term appears", () => {
    const budget = keywords.find((candidate) => candidate.term === "retry budget");
    expect(budget?.inHeading).toBe(true);
  });

  it("uses the corpus to demote a term every other post also uses", () => {
    const corpus = Array.from({ length: 8 }, () => "retry budget retry budget retry budget");
    const withCorpus = extractKeywords({
      title: "Retries and the dead-letter queue",
      body: POST,
      corpus,
    });
    const rankIn = (list: { term: string }[]) => list.findIndex((c) => c.term === "retry budget");
    expect(rankIn(withCorpus)).toBeGreaterThan(rankIn(keywords));
  });

  it("returns nothing for an empty draft", () => {
    expect(extractKeywords({ title: "", body: "" })).toEqual([]);
  });

  it("honours the limit", () => {
    expect(extractKeywords({ title: "Retries", body: POST }, 3)).toHaveLength(3);
  });
});

describe("auditPost", () => {
  const base: AuditInput = {
    title: "Retries and the dead-letter queue in FlexiQ",
    description:
      "How FlexiQ decides when to retry a failed task, what the retry budget does, and where a task ends up once that budget is spent.",
    slug: "retries-and-the-dlq",
    body: POST,
    tags: ["reliability"],
    primaryKeyword: "retry budget",
  };

  const byId = (input: AuditInput) =>
    Object.fromEntries(auditPost(input).map((check) => [check.id, check]));

  it("passes a well-formed post", () => {
    const checks = byId(base);
    expect(checks.title.status).toBe("pass");
    expect(checks.description.status).toBe("pass");
    expect(checks.slug.status).toBe("pass");
    expect(checks.headings.status).toBe("pass");
    expect(checks.links.status).toBe("pass");
    expect(checks.tags.status).toBe("pass");
  });

  it("fails an empty title and an empty description", () => {
    const checks = byId({ ...base, title: "", description: "" });
    expect(checks.title.status).toBe("fail");
    expect(checks.description.status).toBe("fail");
  });

  it("rejects a slug that is not kebab-case", () => {
    expect(byId({ ...base, slug: "Retries And DLQ" }).slug.status).toBe("fail");
  });

  it("warns when the description is the wrong length, with the count", () => {
    const short = byId({ ...base, description: "Too short." }).description;
    expect(short.status).toBe("warn");
    expect(short.detail).toContain("10 characters");
  });

  it("warns when the primary keyword is missing from the title", () => {
    expect(byId({ ...base, title: "Something else entirely here" })["keyword-title"].status).toBe(
      "warn",
    );
  });

  it("asks for a keyword when none is chosen", () => {
    expect(byId({ ...base, primaryKeyword: undefined }).keyword.status).toBe("warn");
  });

  it("notices a skipped heading level", () => {
    const checks = byId({ ...base, body: "## Two\n\n#### Four\n\nSome prose here to count." });
    expect(checks.headings.status).toBe("warn");
    expect(checks.headings.detail).toContain("h2 to h4");
  });

  it("notices a body that starts at h1", () => {
    expect(byId({ ...base, body: "# One\n\nProse." }).headings.detail).toContain("Start the body");
  });

  it("warns about a thin post and fails an empty one", () => {
    expect(byId({ ...base, body: "Only a few words here." }).length.status).toBe("warn");
    expect(byId({ ...base, body: "" }).length.status).toBe("fail");
  });

  it("warns when nothing links inward", () => {
    expect(byId({ ...base, body: "See [elsewhere](https://example.com)." }).links.status).toBe(
      "warn",
    );
  });
});

describe("auditScore", () => {
  it("scores passes fully, warnings at half, failures at nothing", () => {
    expect(
      auditScore([
        { id: "a", label: "", status: "pass", detail: "" },
        { id: "b", label: "", status: "warn", detail: "" },
        { id: "c", label: "", status: "fail", detail: "" },
        { id: "d", label: "", status: "pass", detail: "" },
      ]),
    ).toBe(63);
  });

  it("is zero with nothing to score", () => {
    expect(auditScore([])).toBe(0);
  });
});
