import { afterEach, describe, expect, it } from "vitest";
import { maxFileBytes } from "./limits";
import { checkAttachment, RESEND_MAX_EMAIL_BYTES } from "./model";

const MB = 1024 * 1024;

afterEach(() => {
  delete process.env.ADMIN_MAX_ATTACHMENT_BYTES;
});

describe("maxFileBytes", () => {
  it("honours a raised per-file limit where the platform allows one", () => {
    process.env.ADMIN_MAX_ATTACHMENT_BYTES = String(25 * MB);

    expect(maxFileBytes()).toBe(25 * MB);
    expect(
      checkAttachment({ filename: "video.mp4", byteSize: 20 * MB }, [], 0, maxFileBytes()).ok,
    ).toBe(true);
  });

  it("never lets the per-file limit exceed the whole-email one", () => {
    process.env.ADMIN_MAX_ATTACHMENT_BYTES = String(500 * MB);
    expect(maxFileBytes()).toBe(RESEND_MAX_EMAIL_BYTES);
  });

  it("refuses a file that does not fit beside what is already attached", () => {
    process.env.ADMIN_MAX_ATTACHMENT_BYTES = String(25 * MB);
    const existing = [{ byteSize: 20 * MB }, { byteSize: 8 * MB }];

    const verdict = checkAttachment(
      { filename: "extra.pdf", byteSize: 5 * MB },
      existing,
      0,
      maxFileBytes(),
    );

    expect(verdict.ok).toBe(false);
    expect(verdict.ok === false && verdict.message).toContain("left");
  });
});
