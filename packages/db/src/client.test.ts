import { describe, expect, it } from "vitest";
import { poolConfig, resolveSslMode } from "./client";

const REMOTE = "postgresql://user:pw@db.example.com:5432/app";
const LOCAL = "postgresql://user:pw@localhost:5432/app";

describe("resolveSslMode", () => {
  it("defaults a remote host to a verified TLS connection", () => {
    expect(resolveSslMode(REMOTE, undefined)).toBe("require");
  });

  it("defaults localhost to no TLS", () => {
    expect(resolveSslMode(LOCAL, undefined)).toBe("disable");
    expect(resolveSslMode("postgresql://user:pw@127.0.0.1:5432/app", undefined)).toBe("disable");
  });

  it("lets the override win over the host default", () => {
    expect(resolveSslMode(LOCAL, "require")).toBe("require");
    expect(resolveSslMode(REMOTE, "disable")).toBe("disable");
  });

  it("accepts the override in any casing, with surrounding space", () => {
    expect(resolveSslMode(REMOTE, "  No-Verify ")).toBe("no-verify");
  });

  it("rejects an unrecognised override rather than silently downgrading", () => {
    expect(() => resolveSslMode(REMOTE, "yes")).toThrow(/DATABASE_SSL must be one of/);
  });

  it("treats an unparseable url as remote, which is the safe guess", () => {
    expect(resolveSslMode("not a url", undefined)).toBe("require");
  });
});

describe("poolConfig", () => {
  it("verifies certificates under require", () => {
    expect(poolConfig(REMOTE, "require").ssl).toEqual({ rejectUnauthorized: true });
  });

  it("keeps TLS but skips verification under no-verify", () => {
    expect(poolConfig(REMOTE, "no-verify").ssl).toEqual({ rejectUnauthorized: false });
  });

  it("turns TLS off entirely under disable", () => {
    expect(poolConfig(LOCAL, "disable").ssl).toBe(false);
  });

  it("passes the connection string through untouched", () => {
    expect(poolConfig(REMOTE, "require").connectionString).toBe(REMOTE);
  });
});
