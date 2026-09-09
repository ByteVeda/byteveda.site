import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isBuildPhase, poolConfig, resolveSslMode } from "./client";

const REMOTE = "postgresql://user:pw@db.example.com:5432/app";
const LOCAL = "postgresql://user:pw@localhost:5432/app";

/**
 * The override defaults to `process.env.DATABASE_SSL`, so a machine that has it
 * set — CI points at a local Postgres with TLS off — would otherwise decide the
 * result of every inference test. Blank it so these assert the inference.
 */
beforeEach(() => vi.stubEnv("DATABASE_SSL", ""));
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
