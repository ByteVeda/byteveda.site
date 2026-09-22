import { afterEach, describe, expect, it, vi } from "vitest";
import { corsHeaders, isAllowedOrigin } from "./cors";

/** `cors.ts` reads NODE_ENV at call time, so stubbing it is enough. */
function setEnv(value: string) {
  vi.stubEnv("NODE_ENV", value as "production" | "development" | "test");
}

afterEach(() => vi.unstubAllEnvs());

describe("isAllowedOrigin", () => {
  it("allows the public sites in production", () => {
    setEnv("production");
    expect(isAllowedOrigin("https://byteveda.org")).toBe(true);
    expect(isAllowedOrigin("https://flexiq.byteveda.org")).toBe(true);
  });

  it("refuses everything else in production, tunnels included", () => {
    setEnv("production");
    expect(isAllowedOrigin("https://evil.example.com")).toBe(false);
    expect(isAllowedOrigin("http://localhost:3000")).toBe(false);
    expect(isAllowedOrigin("https://abc123.ngrok-free.app")).toBe(false);
  });

  it("allows localhost and ngrok outside production", () => {
    setEnv("development");
    expect(isAllowedOrigin("http://localhost:3000")).toBe(true);
    expect(isAllowedOrigin("http://127.0.0.1:3002")).toBe(true);
    expect(isAllowedOrigin("https://abc-123.ngrok-free.app")).toBe(true);
    expect(isAllowedOrigin("https://tunnel.ngrok.io")).toBe(true);
  });

  it("does not let a lookalike host through the ngrok pattern", () => {
    setEnv("development");
    expect(isAllowedOrigin("https://ngrok-free.app.evil.com")).toBe(false);
    expect(isAllowedOrigin("https://evil.com/x.ngrok-free.app")).toBe(false);
    expect(isAllowedOrigin("http://abc.ngrok-free.app")).toBe(false);
  });

  it("refuses a missing origin", () => {
    expect(isAllowedOrigin(null)).toBe(false);
  });
});

describe("corsHeaders", () => {
  it("echoes an allowed origin rather than answering with a wildcard", () => {
    setEnv("production");
    const headers = corsHeaders("https://byteveda.org");
    expect(headers["access-control-allow-origin"]).toBe("https://byteveda.org");
    expect(headers.vary).toBe("origin");
  });

  it("sends no allow-origin at all for a refused origin", () => {
    setEnv("production");
    expect(corsHeaders("https://evil.example.com")).toEqual({ vary: "origin" });
  });
});
