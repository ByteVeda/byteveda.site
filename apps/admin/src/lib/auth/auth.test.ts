import { describe, expect, it } from "vitest";
import { isSuperAdminId, parseAllowlist, superAdmins } from "./allowlist";
import {
  accessFor,
  can,
  canReadWorkspace,
  PERMISSIONS,
  permissionsFor,
  readableWorkspaces,
  roleLabel,
  SUPER_ADMIN_GITHUB_IDS,
} from "./roles";
import { safeNext } from "./urls";

describe("parseAllowlist", () => {
  it("reads a comma-separated list, tolerating whitespace", () => {
    expect(parseAllowlist(" 67143288 , 12345 ")).toEqual([67143288, 12345]);
  });

  it("treats unset and empty as nobody", () => {
    expect(parseAllowlist(undefined)).toEqual([]);
    expect(parseAllowlist("")).toEqual([]);
    expect(parseAllowlist(" , ")).toEqual([]);
  });

  it("refuses a login where an id belongs, rather than silently ignoring it", () => {
    expect(() => parseAllowlist("kartikeya-27")).toThrow(/numeric GitHub user IDs/);
  });

  it("refuses values that are not positive integers", () => {
    expect(() => parseAllowlist("0")).toThrow();
    expect(() => parseAllowlist("-4")).toThrow();
    expect(() => parseAllowlist("1.5")).toThrow();
  });
});

describe("isSuperAdminId", () => {
  it("admits an id on the list and refuses one that is not", () => {
    expect(isSuperAdminId(67143288, [67143288, 1])).toBe(true);
    expect(isSuperAdminId(999, [67143288, 1])).toBe(false);
  });

  it("refuses everyone when the list is empty", () => {
    expect(isSuperAdminId(67143288, [])).toBe(false);
  });
});

describe("superAdmins", () => {
  it("is the hardcoded list, so an empty environment still has a way in", () => {
    delete process.env.ADMIN_GITHUB_IDS;
    expect(superAdmins()).toEqual([...SUPER_ADMIN_GITHUB_IDS]);
  });

  it("merges ADMIN_GITHUB_IDS without duplicating what is already in source", () => {
    process.env.ADMIN_GITHUB_IDS = `4242, ${SUPER_ADMIN_GITHUB_IDS[0]}`;
    const ids = superAdmins();

    expect(ids).toContain(4242);
    expect(ids.filter((id) => id === SUPER_ADMIN_GITHUB_IDS[0])).toHaveLength(1);
    delete process.env.ADMIN_GITHUB_IDS;
  });
});

describe("accessFor", () => {
  const editor = { role: "editor" as const, mailWorkspaces: ["academy" as const] };

  it("gives a super admin everything, whatever their row says", () => {
    const access = accessFor({ role: "viewer", mailWorkspaces: [] }, true);

    expect(access.superAdmin).toBe(true);
    expect(access.permissions).toEqual(PERMISSIONS);
    expect(access.workspaces).toEqual(["byteveda", "academy"]);
    expect(roleLabel(access)).toBe("Super admin");
  });

  it("gives everybody else exactly what their role carries", () => {
    const access = accessFor(editor, false);

    expect(access.permissions).toEqual(permissionsFor("editor"));
    expect(can(access, "posts.publish")).toBe(true);
    expect(can(access, "settings.write")).toBe(false);
    expect(can(access, "members.manage")).toBe(false);
  });

  it("scopes mail by workspace as well as by permission", () => {
    const access = accessFor(editor, false);

    expect(canReadWorkspace(access, "academy")).toBe(true);
    expect(canReadWorkspace(access, "byteveda")).toBe(false);
    expect(readableWorkspaces(access)).toEqual(["academy"]);
  });

  it("gives no mail at all to a role without the permission, however it is scoped", () => {
    const access = accessFor({ role: "viewer", mailWorkspaces: ["byteveda"] }, false);
    const noMail = { ...access, permissions: [] };

    expect(canReadWorkspace(noMail, "byteveda")).toBe(false);
    expect(readableWorkspaces(noMail)).toEqual([]);
  });
});

describe("members.manage", () => {
  it("belongs to nobody but a super admin", () => {
    for (const role of ["admin", "editor", "support", "viewer"] as const) {
      expect(permissionsFor(role)).not.toContain("members.manage");
    }
  });
});

describe("safeNext", () => {
  it("keeps an in-app path", () => {
    expect(safeNext("/posts/abc?tab=seo")).toBe("/posts/abc?tab=seo");
  });

  it("falls back to the dashboard when there is nothing to honour", () => {
    expect(safeNext(null)).toBe("/");
    expect(safeNext(undefined)).toBe("/");
    expect(safeNext("")).toBe("/");
  });

  it("refuses to bounce the operator off-site after login", () => {
    expect(safeNext("https://evil.example.com")).toBe("/");
    expect(safeNext("//evil.example.com")).toBe("/");
    expect(safeNext("/\\evil.example.com")).toBe("/");
    expect(safeNext("javascript:alert(1)")).toBe("/");
  });
});
