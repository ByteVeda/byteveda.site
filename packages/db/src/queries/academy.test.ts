import { describe, expect, it } from "vitest";

import { isUniqueViolation } from "./academy";

/**
 * The academy's one-sample-per-address rule is a unique constraint, which
 * means the whole rule rests on recognising one Postgres error code. Drizzle
 * does not hand it over directly — it throws a `DrizzleQueryError` and puts
 * what `pg` threw on `cause` — so a check against the top-level object silently
 * turns "you already have one" into a 500. It did, until a run against a real
 * database caught it.
 */
describe("isUniqueViolation", () => {
  it("reads the code off a bare pg error", () => {
    expect(isUniqueViolation(Object.assign(new Error("duplicate key"), { code: "23505" }))).toBe(
      true,
    );
  });

  it("reads it through the wrapper drizzle actually throws", () => {
    const pgError = Object.assign(new Error("duplicate key value"), {
      code: "23505",
      constraint: "sample_requests_email_key",
    });
    const wrapped = Object.assign(new Error("Failed query: insert into ..."), { cause: pgError });

    expect(isUniqueViolation(wrapped)).toBe(true);
  });

  it("leaves every other failure alone", () => {
    expect(isUniqueViolation(Object.assign(new Error("no relation"), { code: "42P01" }))).toBe(
      false,
    );
    expect(isUniqueViolation(new Error("connection terminated"))).toBe(false);
    expect(isUniqueViolation(undefined)).toBe(false);
    expect(isUniqueViolation("23505")).toBe(false);
  });

  it("does not follow a cause chain forever", () => {
    const loop: { cause?: unknown } = {};
    loop.cause = loop;

    expect(isUniqueViolation(loop)).toBe(false);
  });
});
