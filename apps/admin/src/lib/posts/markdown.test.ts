import { describe, expect, it } from "vitest";
import { containsJsx, htmlToMarkdown, markdownToHtml } from "./markdown";

describe("htmlToMarkdown", () => {
  it("uses ATX headings and hyphen bullets", () => {
    expect(htmlToMarkdown("<h2>Retries</h2><ul><li>one</li><li>two</li></ul>")).toBe(
      "## Retries\n\n-   one\n-   two",
    );
  });

  it("keeps the language on a fenced code block", () => {
    const markdown = htmlToMarkdown(
      '<pre><code class="language-python">queue.enqueue(job)</code></pre>',
    );
    expect(markdown).toContain("```python");
    expect(markdown).toContain("queue.enqueue(job)");
  });

  it("fences a code block that has no language", () => {
    expect(htmlToMarkdown("<pre><code>plain</code></pre>")).toBe("```\nplain\n```");
  });

  it("converts strikethrough, which turndown does not handle by default", () => {
    expect(htmlToMarkdown("<p>a <s>gone</s> b</p>")).toBe("a ~~gone~~ b");
  });

  it("keeps links and emphasis", () => {
    expect(htmlToMarkdown('<p><em>see</em> <a href="/docs">the docs</a></p>')).toBe(
      "*see* [the docs](/docs)",
    );
  });
});

describe("markdownToHtml", () => {
  it("renders headings, lists, and links", () => {
    const html = markdownToHtml("## Title\n\n- one\n\n[docs](/x)");
    expect(html).toContain("<h2>Title</h2>");
    expect(html).toContain("<li>one</li>");
    expect(html).toContain('href="/x"');
  });

  it("renders GitHub-flavoured tables", () => {
    expect(markdownToHtml("| a | b |\n| - | - |\n| 1 | 2 |")).toContain("<table>");
  });

  it("round-trips a simple document back to the same Markdown", () => {
    const source = "## Retries\n\nThe queue *retries* a [task](/docs).";
    expect(htmlToMarkdown(markdownToHtml(source))).toBe(source);
  });
});

describe("containsJsx", () => {
  it("spots a component, an import, and an export", () => {
    expect(containsJsx('text <Callout kind="warn" /> more')).toBe(true);
    expect(containsJsx("<Chart>\n  data\n</Chart>")).toBe(true);
    expect(containsJsx('import Chart from "./chart";')).toBe(true);
    expect(containsJsx("export const meta = 1;")).toBe(true);
  });

  it("leaves plain Markdown alone", () => {
    expect(containsJsx("## Title\n\nSome **prose** and a [link](/x).")).toBe(false);
  });

  it("does not mistake a lowercase HTML tag for a component", () => {
    expect(containsJsx("a <br /> b <span>c</span>")).toBe(false);
  });

  it("ignores JSX that only appears inside code samples", () => {
    expect(containsJsx("```jsx\n<Component />\n```")).toBe(false);
    expect(containsJsx("use `<Callout />` like this")).toBe(false);
  });
});
