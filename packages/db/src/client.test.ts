import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isBuildPhase, poolConfig, poolerMode, resolveSslMode } from "./client";

const REMOTE = "postgresql://user:pw@db.example.com:5432/app";
const LOCAL = "postgresql://user:pw@localhost:5432/app";
const SESSION =
  "postgresql://postgres.abc:pw@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres";
const TRANSACTION =
  "postgresql://postgres.abc:pw@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres";

/**
 * The override defaults to `process.env.DATABASE_SSL`, so a machine that has it
 * set — CI points at a local Postgres with TLS off — would otherwise decide the
 * result of every inference test. Blank it so these assert the inference.
 */
beforeEach(() => {
  vi.stubEnv("DATABASE_SSL", "");
  vi.stubEnv("DATABASE_POOL_MAX", "");
});
afterEach(() => vi.unstubAllEnvs());

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

  it("holds fewer connections against session mode, where each one is pinned", () => {
    expect(poolConfig(SESSION, "require").max).toBe(2);
  });

  it("allows the usual ceiling once the pooler hands connections back", () => {
    expect(poolConfig(TRANSACTION, "require").max).toBe(5);
    expect(poolConfig(REMOTE, "require").max).toBe(5);
  });

  it("lets DATABASE_POOL_MAX override either default", () => {
    vi.stubEnv("DATABASE_POOL_MAX", "12");
    expect(poolConfig(SESSION, "require").max).toBe(12);
  });

  it("ignores a DATABASE_POOL_MAX that is not a usable number", () => {
    vi.stubEnv("DATABASE_POOL_MAX", "none");
    expect(poolConfig(TRANSACTION, "require").max).toBe(5);
    vi.stubEnv("DATABASE_POOL_MAX", "0");
    expect(poolConfig(TRANSACTION, "require").max).toBe(5);
  });

  it("caps how long one query may hold a pooler slot", () => {
    expect(poolConfig(REMOTE, "require").query_timeout).toBe(30_000);
  });
});

describe("poolerMode", () => {
  it("reads Supavisor's transaction port", () => {
    expect(poolerMode(TRANSACTION)).toBe("transaction");
  });

  it("treats every other port on a Supavisor host as session mode", () => {
    expect(poolerMode(SESSION)).toBe("session");
    expect(
      poolerMode("postgresql://postgres.abc:pw@aws-0-eu-west-2.pooler.supabase.com/postgres"),
    ).toBe("session");
  });

  it("says nothing about a database it cannot identify", () => {
    expect(poolerMode(REMOTE)).toBe("direct");
    expect(poolerMode(LOCAL)).toBe("direct");
    // A host that merely ends in something similar is not Supavisor.
    expect(poolerMode("postgresql://user:pw@pooler.supabase.com.evil.test:6543/app")).toBe(
      "direct",
    );
  });

  it("treats an unparseable url as a database of our own", () => {
    expect(poolerMode("not a url")).toBe("direct");
  });
});

describe("isBuildPhase", () => {
  it("is true while next build is prerendering", () => {
    vi.stubEnv("NEXT_PHASE", "phase-production-build");
    expect(isBuildPhase()).toBe(true);
  });

  it("is false on a running server, where a failed read is an incident", () => {
    vi.stubEnv("NEXT_PHASE", "phase-production-server");
    expect(isBuildPhase()).toBe(false);
  });

  it("is false when nothing set the phase at all", () => {
    vi.stubEnv("NEXT_PHASE", "");
    expect(isBuildPhase()).toBe(false);
  });
});
