import { describe, expect, it } from "vitest";
import { bodyMissing, fetchFailureReason, type InboundEvent, inboundRow } from "./inbound";

/** What Resend actually posts: an envelope and an id. No body. */
const EVENT: InboundEvent = {
  email_id: "b2f1c0de-0000-4000-8000-000000000001",
  from: '"Ada Lovelace" <Ada@Example.TEST>',
  to: ["conduct@byteveda.org"],
  subject: "Re: Test mail",
};

describe("inboundRow", () => {
  it("takes the body from the fetched message, not the webhook", () => {
    const row = inboundRow(EVENT, { text: "Hello there.", html: "<p>Hello there.</p>" });

    expect(row.text).toBe("Hello there.");
    expect(row.html).toBe("<p>Hello there.</p>");
  });

  it("stores an empty body when the fetch produced nothing, rather than dropping the mail", () => {
    const row = inboundRow(EVENT);

    expect(row.text).toBe("");
    expect(row.html).toBeNull();
    expect(row.resendId).toBe(EVENT.email_id);
  });

  it("does not let a blank fetched body mask one the payload carried", () => {
    const row = inboundRow({ ...EVENT, text: "inlined" }, { text: "   ", html: null });

    expect(row.text).toBe("inlined");
  });

  it("normalises the addresses and keeps the display name", () => {
    const row = inboundRow(EVENT);

    expect(row.fromEmail).toBe("ada@example.test");
    expect(row.fromName).toBe("Ada Lovelace");
    expect(row.toEmail).toBe("conduct@byteveda.org");
  });

  it("threads a reply with the message it answers", () => {
    const first = inboundRow({ ...EVENT, subject: "Test mail" });

    expect(inboundRow(EVENT).threadKey).toBe(first.threadKey);
  });

  it("takes the first recipient when the envelope lists several", () => {
    expect(inboundRow({ ...EVENT, to: ["a@byteveda.org", "b@byteveda.org"] }).toEmail).toBe(
      "a@byteveda.org",
    );
    expect(inboundRow({ ...EVENT, to: "solo@byteveda.org" }).toEmail).toBe("solo@byteveda.org");
    expect(inboundRow({ ...EVENT, to: undefined }).toEmail).toBe("");
  });

  it("prefers the fetched headers and falls back to the payload's", () => {
    expect(inboundRow(EVENT, { headers: { "message-id": "<1@a>" } }).headers).toEqual({
      "message-id": "<1@a>",
    });
    expect(inboundRow({ ...EVENT, headers: { "message-id": "<2@a>" } }).headers).toEqual({
      "message-id": "<2@a>",
    });
    expect(inboundRow(EVENT).headers).toBeNull();
  });
});

describe("bodyMissing", () => {
  it("is true for the rows stored before the body was ever fetched", () => {
    expect(bodyMissing({ text: "", html: null })).toBe(true);
    expect(bodyMissing({ text: "  \n ", html: "   " })).toBe(true);
  });

  it("is false as soon as either form of the message is present", () => {
    expect(bodyMissing({ text: "hello", html: null })).toBe(false);
    expect(bodyMissing({ text: "", html: "<p>hello</p>" })).toBe(false);
  });
});

describe("fetchFailureReason", () => {
  /**
   * The bug this whole path exists for: a sending-access key sends mail
   * perfectly and cannot read a single inbound message, and the console used to
   * render that as a blank conversation.
   */
  it("names the sending-only key, and what to replace it with", () => {
    const reason = fetchFailureReason({
      name: "restricted_api_key",
      message: "This API key is restricted to only send emails",
    });

    expect(reason).toContain("RESEND_API_KEY");
    expect(reason).toContain("full-access");
  });

  it("covers the other codes an operator can act on", () => {
    expect(fetchFailureReason({ name: "invalid_api_key" })).toContain("rejected");
    expect(fetchFailureReason({ name: "missing_api_key" })).toContain("not set");
    expect(fetchFailureReason({ name: "not_found" })).toContain("no longer");
  });

  // Resend's error codes are a closed union today and will not be tomorrow.
  it("passes an unrecognised error through rather than swallowing it", () => {
    expect(fetchFailureReason({ name: "teapot", message: "I am a teapot" })).toContain(
      "I am a teapot",
    );
    expect(fetchFailureReason({})).toBe("Resend could not return it.");
    expect(fetchFailureReason({ message: "   " })).toBe("Resend could not return it.");
  });
});
