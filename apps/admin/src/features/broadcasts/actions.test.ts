import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Every action in this file is a public endpoint.
 *
 * A `"use server"` export is reachable by anyone who can reach the app, so the
 * permission check is not a courtesy to match the hidden button — it is the
 * only thing between a demoted operator and the list's mail. These tests hold
 * the read to the same rule as the writes.
 */

type Refusal = { ok: false; message: string };

const refuse = vi.fn<(permission: string) => Promise<Refusal | null>>();
const select = vi.fn();

vi.mock("@/features/auth", () => ({
  refuse: (permission: string) => refuse(permission),
}));

vi.mock("@byteveda/db", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  getDb: () => ({ select }),
}));

const { listBroadcasts } = await import("./actions");

const drafts = [{ id: "draft-1", subject: "Release notes" }];

beforeEach(() => {
  refuse.mockReset();
  select.mockReset();
  select.mockReturnValue({
    from: () => ({ orderBy: () => ({ limit: () => Promise.resolve(drafts) }) }),
  });
});

describe("listBroadcasts", () => {
  it("returns the drafts to an operator who may send them", async () => {
    refuse.mockResolvedValue(null);

    await expect(listBroadcasts()).resolves.toEqual(drafts);
    expect(refuse).toHaveBeenCalledWith("broadcasts.send");
  });

  it("tells an operator without the permission nothing", async () => {
    refuse.mockResolvedValue({ ok: false, message: "Your role does not allow that." });

    await expect(listBroadcasts()).resolves.toEqual([]);
  });

  it("asks before it reads, so the rows are never fetched for a refusal", async () => {
    refuse.mockResolvedValue({ ok: false, message: "Your role does not allow that." });

    await listBroadcasts();

    expect(select).not.toHaveBeenCalled();
  });
});
