import { describe, expect, it } from "vitest";
import {
  BLOCKED_EXTENSIONS,
  checkAttachment,
  checkMessage,
  encodedSize,
  extensionOf,
  formatBytes,
  isBlocked,
  MIME_OVERHEAD_BYTES,
  RESEND_MAX_EMAIL_BYTES,
  remainingBytes,
  safeFilename,
} from "./model";

const MB = 1024 * 1024;

describe("encodedSize", () => {
  it("is four characters per three bytes, rounded up to the group", () => {
    expect(encodedSize(3)).toBe(4);
    expect(encodedSize(1)).toBe(4);
    expect(encodedSize(4)).toBe(8);
    expect(encodedSize(300)).toBe(400);
  });

  it("is what makes Resend's 40MB about 30MB of files", () => {
    // The limit is stated *after* Base64, which is the whole reason this
    // function exists: 40MB of files is a 54MB email and is refused.
    expect(encodedSize(40 * MB)).toBeGreaterThan(RESEND_MAX_EMAIL_BYTES);
    expect(encodedSize(29 * MB)).toBeLessThan(RESEND_MAX_EMAIL_BYTES);
  });
});

describe("remainingBytes", () => {
  it("counts the body and the MIME framing against the budget", () => {
    const all = remainingBytes(0);
    const withBody = remainingBytes(0, 100_000);

    expect(all).toBeLessThan(RESEND_MAX_EMAIL_BYTES);
    expect(withBody).toBeLessThan(all);
  });

  it("never goes negative, however overloaded the message is", () => {
    expect(remainingBytes(80 * MB)).toBe(0);
  });

  it("agrees with checkMessage at the boundary", () => {
    const left = remainingBytes(0);

    expect(checkMessage([{ byteSize: left }]).ok).toBe(true);
    // One byte over the stated budget, allowing for the rounding in both
    // directions, has to be refused rather than sent and rejected by Resend.
    expect(checkMessage([{ byteSize: left + MIME_OVERHEAD_BYTES }]).ok).toBe(false);
  });
});

describe("isBlocked", () => {
  it("refuses what Resend refuses", () => {
    expect(isBlocked("payload.exe")).toBe(true);
    expect(isBlocked("hook.js")).toBe(true);
    expect(isBlocked("Installer.MSI")).toBe(true);
    expect(isBlocked("shortcut.lnk")).toBe(true);
  });

  it("allows what an operator actually sends", () => {
    expect(isBlocked("chapter-3.pdf")).toBe(false);
    expect(isBlocked("worksheet.docx")).toBe(false);
    expect(isBlocked("screenshot.png")).toBe(false);
    expect(isBlocked("answers.zip")).toBe(false);
  });

  it("is the whole published list, not a guess at the dangerous half", () => {
    expect(BLOCKED_EXTENSIONS).toHaveLength(89);
    expect(BLOCKED_EXTENSIONS).toContain("mdb");
    expect(BLOCKED_EXTENSIONS).toContain("msh2xml");
  });

  it("does not trip over a name with no extension, or a dotfile", () => {
    expect(extensionOf("README")).toBe("");
    expect(extensionOf(".gitignore")).toBe("");
    expect(isBlocked("README")).toBe(false);
  });
});

describe("safeFilename", () => {
  it("keeps the name and drops the path", () => {
    expect(safeFilename("chapter-3.pdf")).toBe("chapter-3.pdf");
    expect(safeFilename("../../etc/passwd")).toBe("passwd");
    expect(safeFilename("C:\\Users\\me\\notes.txt")).toBe("notes.txt");
  });

  it("strips what would break a Content-Disposition header", () => {
    expect(safeFilename('in"jected.pdf')).toBe("injected.pdf");
    expect(safeFilename("two\r\nlines.pdf")).toBe("twolines.pdf");
  });

  it("always answers with something", () => {
    expect(safeFilename("")).toBe("attachment");
    expect(safeFilename("   ")).toBe("attachment");
  });
});

describe("checkAttachment", () => {
  it("takes an ordinary file", () => {
    expect(checkAttachment({ filename: "sheet.pdf", byteSize: 900_000 }).ok).toBe(true);
  });

  it("refuses an empty one rather than storing a zero-byte row", () => {
    expect(checkAttachment({ filename: "sheet.pdf", byteSize: 0 }).ok).toBe(false);
  });

  it("names the per-file limit, because the operator has to act on it", () => {
    const verdict = checkAttachment({ filename: "video.mp4", byteSize: 20 * MB });

    expect(verdict.ok).toBe(false);
    expect(verdict.ok === false && verdict.message).toContain("4.0 MB");
  });
});

describe("formatBytes", () => {
  it("reads the way a file manager does", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(2048)).toBe("2 KB");
    expect(formatBytes(3 * MB)).toBe("3.0 MB");
  });
});
