import { describe, expect, it } from "vitest";
import { isMailWorkspace, workspaceOf } from "./workspaces";

describe("workspaceOf", () => {
  it("files the academy's own mailboxes under the academy", () => {
    expect(workspaceOf("academy@byteveda.org")).toBe("academy");
    expect(workspaceOf("orders@byteveda.org")).toBe("academy");
    expect(workspaceOf("samples@byteveda.org")).toBe("academy");
  });

  it("files anything on an academy subdomain under the academy", () => {
    expect(workspaceOf("hello@academy.byteveda.org")).toBe("academy");
  });

  it("leaves the rest of the organisation where it was", () => {
    expect(workspaceOf("hello@byteveda.org")).toBe("byteveda");
    expect(workspaceOf("support@byteveda.org")).toBe("byteveda");
    expect(workspaceOf("conduct@byteveda.org")).toBe("byteveda");
  });

  it("does not mistake a domain for a mailbox name", () => {
    // The rule is "the academy's subdomain", not "the word appears somewhere".
    expect(workspaceOf("hello@byteveda-academy.com")).toBe("byteveda");
    expect(workspaceOf("hello@notacademy.byteveda.org")).toBe("byteveda");
  });

  it("reads through case, whitespace and a plus tag", () => {
    expect(workspaceOf("  Orders@ByteVeda.org ")).toBe("academy");
    expect(workspaceOf("orders+urgent@byteveda.org")).toBe("academy");
  });

  it("files the academy's own mail to itself under the academy", () => {
    // Every sample request sends a work order from academy@ to whatever
    // ACADEMY_ORDER_INBOX names, and that defaults to support@ — an address
    // this would otherwise read as ByteVeda's.
    expect(workspaceOf("support@byteveda.org", "academy@byteveda.org")).toBe("academy");
    expect(workspaceOf("hello@byteveda.org", "orders@byteveda.org")).toBe("academy");
  });

  it("does not let an ordinary correspondent drag mail across", () => {
    expect(workspaceOf("hello@byteveda.org", "ada@example.test")).toBe("byteveda");
  });

  it("has an answer for a mailbox that was never recorded", () => {
    // `email_threads.mailbox` defaults to the empty string, and every row from
    // before the column existed has one.
    expect(workspaceOf("")).toBe("byteveda");
  });
});

describe("isMailWorkspace", () => {
  it("guards a query string, which is where these arrive from", () => {
    expect(isMailWorkspace("academy")).toBe(true);
    expect(isMailWorkspace("byteveda")).toBe(true);
    expect(isMailWorkspace("everything")).toBe(false);
    expect(isMailWorkspace(undefined)).toBe(false);
  });
});
