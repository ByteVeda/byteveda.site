import { describe, expect, it } from "vitest";
import { expectedSignature, verifySignature } from "./webhook";

const SECRET = `whsec_${Buffer.from("a-test-signing-key").toString("base64")}`;
const BODY = '{"type":"email.received","data":{"from":"ada@example.test"}}';
const ID = "msg_123";
const NOW = 1_757_000_000_000;
const TIMESTAMP = String(Math.floor(NOW / 1000));

function signed(overrides: Partial<Parameters<typeof verifySignature>[0]> = {}) {
  return verifySignature({
    secret: SECRET,
    body: BODY,
    id: ID,
    timestamp: TIMESTAMP,
    signature: `v1,${expectedSignature(SECRET, ID, TIMESTAMP, BODY)}`,
    now: NOW,
    ...overrides,
  });
}

describe("verifySignature", () => {
  it("accepts a correctly signed request", () => {
    expect(signed()).toEqual({ ok: true });
  });

  it("accepts when one of several offered signatures matches, for key rotation", () => {
    const good = expectedSignature(SECRET, ID, TIMESTAMP, BODY);
    expect(signed({ signature: `v1,ZmFrZQ== v1,${good}` })).toEqual({ ok: true });
  });

  it("rejects a body that changed after signing", () => {
    expect(signed({ body: `${BODY} ` }).ok).toBe(false);
  });

  it("rejects a signature for a different message id", () => {
    expect(
      signed({ signature: `v1,${expectedSignature(SECRET, "msg_other", TIMESTAMP, BODY)}` }).ok,
    ).toBe(false);
  });

  it("rejects the wrong secret", () => {
    expect(signed({ secret: `whsec_${Buffer.from("other").toString("base64")}` }).ok).toBe(false);
  });

  it("rejects a replay from outside the time window", () => {
    const result = signed({ now: NOW + 10 * 60 * 1000 });
    expect(result).toEqual({ ok: false, reason: "Timestamp outside the accepted window." });
  });

  it("accepts a timestamp slightly in the future, for clock skew", () => {
    expect(signed({ now: NOW - 60 * 1000 }).ok).toBe(true);
  });

  it("rejects an unknown signature version", () => {
    expect(signed({ signature: `v2,${expectedSignature(SECRET, ID, TIMESTAMP, BODY)}` }).ok).toBe(
      false,
    );
  });

  it("reports missing headers and a missing secret distinctly", () => {
    expect(signed({ signature: null })).toEqual({
      ok: false,
      reason: "Missing signature headers.",
    });
    expect(signed({ secret: "" })).toEqual({
      ok: false,
      reason: "RESEND_WEBHOOK_SECRET is not set.",
    });
  });

  it("rejects a malformed timestamp rather than treating it as zero", () => {
    expect(signed({ timestamp: "not-a-number" })).toEqual({
      ok: false,
      reason: "Malformed timestamp.",
    });
  });
});
