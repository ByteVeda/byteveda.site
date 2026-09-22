import { describe, expect, it } from "vitest";
import { composedEmail, confirmationEmail, replyEmail } from "./templates";

/** The wordmark row, which only belongs on mail nobody signs. */
const MASTHEAD = "byteveda<span";
const CONSOLE_FOOTER = "ByteVeda console";

describe("mail an operator writes", () => {
  const composed = composedEmail({
    subject: "Your sheet — Carbon and its Compounds",
    body: "Dear Customer,\n\nPlease find it attached.\n\nWith regards,\nByteVeda Academy",
  });

  it("carries no wordmark, which would contradict the signature below it", () => {
    expect(composed.html).not.toContain(MASTHEAD);
    expect(replyEmail({ subject: "Hi", body: "Sent.", quoted: "" }).html).not.toContain(MASTHEAD);
  });

  it("does not tell the recipient the name of our tooling", () => {
    expect(composed.html).not.toContain(CONSOLE_FOOTER);
    expect(replyEmail({ subject: "Hi", body: "Sent.", quoted: "" }).html).not.toContain(
      CONSOLE_FOOTER,
    );
  });

  it("keeps the subject as typed, rather than claiming to answer something", () => {
    expect(composed.subject).toBe("Your sheet — Carbon and its Compounds");
  });

  it("breaks paragraphs on a blank line and keeps a single newline inside one", () => {
    // Three blank-line-separated blocks, so three paragraphs — the sign-off
    // stays one paragraph even though it is written across two lines.
    expect(composed.html.match(/<p style="margin:0 0 14px;">/g)).toHaveLength(3);
  });

  it("sends the typed text as the plain part, unwrapped", () => {
    expect(composed.text).toContain("With regards,\nByteVeda Academy");
  });

  it("escapes what was typed, because a mail client will render it", () => {
    const html = composedEmail({ subject: "x", body: "<script>alert(1)</script>" }).html;
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
});

describe("replyEmail", () => {
  it("prefixes the subject once and never twice", () => {
    expect(replyEmail({ subject: "Retries", body: "b", quoted: "" }).subject).toBe("Re: Retries");
    expect(replyEmail({ subject: "Re: Retries", body: "b", quoted: "" }).subject).toBe(
      "Re: Retries",
    );
  });

  it("quotes what is being answered, in both parts", () => {
    const email = replyEmail({ subject: "Retries", body: "Fixed.", quoted: "It broke" });
    expect(email.html).toContain("<blockquote");
    expect(email.html).toContain("It broke");
    expect(email.text).toBe("Fixed.\n\n> It broke");
  });

  it("leaves the blockquote out entirely when there is nothing to quote", () => {
    expect(replyEmail({ subject: "Retries", body: "Fixed.", quoted: "  " }).html).not.toContain(
      "<blockquote",
    );
  });
});

describe("mail the console sends on its own account", () => {
  it("keeps the wordmark, because nobody signs it", () => {
    // The other half of the rule: a signup confirmation has no sender named in
    // the body, so the mark at the top is the only thing saying who wrote.
    expect(confirmationEmail("https://byteveda.org/c/abc").html).toContain(MASTHEAD);
  });
});
