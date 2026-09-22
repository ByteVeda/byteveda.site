import { afterEach, describe, expect, it } from "vitest";
import { env } from "./env";

afterEach(() => {
  delete process.env.ADMIN_URL;
});

describe("env.adminOrigin", () => {
  it("is what the deployment configured", () => {
    process.env.ADMIN_URL = "https://console.example.test";

    expect(env.adminOrigin()).toBe("https://console.example.test");
  });

  it("drops a trailing slash, so a link built from it has one separator", () => {
    process.env.ADMIN_URL = "https://console.example.test/";

    expect(env.adminOrigin()).toBe("https://console.example.test");
  });

  it("falls back to the production console, which is where the mail points", () => {
    expect(env.adminOrigin()).toBe("https://admin.byteveda.org");
  });
});
