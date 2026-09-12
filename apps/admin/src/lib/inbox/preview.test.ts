import { describe, expect, it } from "vitest";
import { previewOf } from "./preview";

describe("previewOf", () => {
  it("collapses the whitespace a mail body is full of", () => {
    expect(previewOf("Hello\n\n  there,\tfriend")).toBe("Hello there, friend");
  });

  it("prefers what the sender wrote to what their client made of it", () => {
    expect(previewOf("plain words", "<p>rich words</p>")).toBe("plain words");
  });

  it("falls back to the HTML when there is no text part", () => {
    expect(previewOf("", "<p>Hello <b>there</b></p>")).toBe("Hello there");
  });

  it("does not open a preview with a stylesheet", () => {
    const html = "<style>body{color:red}</style><p>The actual message.</p>";
    expect(previewOf("", html)).toBe("The actual message.");
  });

  it("keeps script contents out too", () => {
    expect(previewOf("", "<script>var a = 1 < 2;</script><p>Real text.</p>")).toBe("Real text.");
  });

  it("decodes the entities that turn up in a first line", () => {
    expect(previewOf("", "<p>Tom &amp; Jerry &lt;3 &quot;quotes&quot;</p>")).toBe(
      'Tom & Jerry <3 "quotes"',
    );
  });

  it("is empty when the message is, so the list can fall back to the subject", () => {
    expect(previewOf("", null)).toBe("");
    expect(previewOf("   ", "<div></div>")).toBe("");
  });

  it("truncates to a length the list can render", () => {
    expect(previewOf("x".repeat(500))).toHaveLength(200);
  });

  it("stays bounded on a body built to make it expensive", () => {
    // Unclosed tags and a very long body: the slice is what keeps this linear.
    const hostile = `${"<script>".repeat(50_000)}tail`;

    const started = performance.now();
    expect(previewOf("", hostile)).toBe("");
    expect(performance.now() - started).toBeLessThan(100);
  });
});
