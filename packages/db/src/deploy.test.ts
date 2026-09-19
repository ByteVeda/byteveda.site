import { describe, expect, it } from "vitest";

import {
  describeTarget,
  type JournalEntry,
  migrationPolicy,
  pendingTags,
  readJournal,
  sessionUrl,
} from "./deploy";

const DIRECT = "postgresql://user:pw@db.example.com:5432/app";
const TRANSACTION =
  "postgresql://postgres.abc:pw@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres";
const SESSION =
  "postgresql://postgres.abc:pw@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres";

/**
 * The environment these run against is built by hand rather than stubbed onto
 * `process.env`, because the thing under test is "given this environment, what
 * happens" — and the machine running the tests has a `DATABASE_URL` of its own.
 */
describe("migrationPolicy", () => {
  it("runs against DATABASE_URL when nothing else is set", () => {
    expect(migrationPolicy({ DATABASE_URL: DIRECT })).toEqual({ run: true, url: DIRECT });
  });

  it("prefers DATABASE_MIGRATE_URL, which is the point of it", () => {
    expect(migrationPolicy({ DATABASE_URL: TRANSACTION, DATABASE_MIGRATE_URL: SESSION })).toEqual({
      run: true,
      url: SESSION,
    });
  });

  it("skips, with a reason, when no database is configured at all", () => {
    const decision = migrationPolicy({});
    expect(decision.run).toBe(false);
    expect(decision).toHaveProperty("reason", expect.stringContaining("DATABASE_URL"));
  });

  it("treats a blank url as no url rather than as a connection string", () => {
    expect(migrationPolicy({ DATABASE_URL: "   " }).run).toBe(false);
  });

  it("stays out of the way when told to", () => {
    for (const off of ["off", "0", "false", "no", "OFF"]) {
      expect(migrationPolicy({ DATABASE_URL: DIRECT, DATABASE_MIGRATE: off }).run).toBe(false);
    }
  });

  /**
   * The guard that matters. Preview and production share a `DATABASE_URL` on
   * plenty of projects, so a preview build of an unmerged branch is one
   * unguarded step away from migrating the live database.
   */
  it("refuses to migrate from a preview build", () => {
    const decision = migrationPolicy({
      DATABASE_URL: DIRECT,
      VERCEL: "1",
      VERCEL_ENV: "preview",
    });

    expect(decision.run).toBe(false);
    expect(decision).toHaveProperty("reason", expect.stringContaining("production"));
  });

  it("migrates from a production build of the same platform", () => {
    expect(
      migrationPolicy({ DATABASE_URL: DIRECT, VERCEL: "1", VERCEL_ENV: "production" }),
    ).toEqual({ run: true, url: DIRECT });
  });

  it("lets force win over the platform's answer", () => {
    expect(
      migrationPolicy({
        DATABASE_URL: DIRECT,
        VERCEL: "1",
        VERCEL_ENV: "preview",
        DATABASE_MIGRATE: "force",
      }),
    ).toEqual({ run: true, url: DIRECT });
  });

  /** An unrecognised platform is a CI job or a server: it chose its database. */
  it("runs where it cannot tell what it is running on", () => {
    expect(migrationPolicy({ DATABASE_URL: DIRECT, CI: "true" }).run).toBe(true);
  });

  it("rejects a flag it does not understand rather than guessing", () => {
    expect(() => migrationPolicy({ DATABASE_URL: DIRECT, DATABASE_MIGRATE: "maybe" })).toThrow(
      /DATABASE_MIGRATE must be one of/,
    );
  });
});

describe("sessionUrl", () => {
  it("moves a Supabase transaction pooler to its session port", () => {
    expect(new URL(sessionUrl(TRANSACTION)).port).toBe("5432");
  });

  it("keeps the credentials and database while doing it", () => {
    const moved = new URL(sessionUrl(TRANSACTION));
    expect(moved.username).toBe("postgres.abc");
    expect(moved.password).toBe("pw");
    expect(moved.pathname).toBe("/postgres");
  });

  it("leaves a session pooler and a direct connection alone", () => {
    expect(sessionUrl(SESSION)).toBe(SESSION);
    expect(sessionUrl(DIRECT)).toBe(DIRECT);
  });

  it("leaves something it cannot parse alone", () => {
    expect(sessionUrl("not a url")).toBe("not a url");
  });
});

describe("describeTarget", () => {
  it("says where without saying who", () => {
    expect(describeTarget(DIRECT)).toBe("db.example.com:5432/app");
    expect(describeTarget(DIRECT)).not.toContain("pw");
  });
});

const JOURNAL: JournalEntry[] = [
  { idx: 0, when: 100, tag: "0000_first" },
  { idx: 1, when: 200, tag: "0001_second" },
  { idx: 2, when: 300, tag: "0002_third" },
];

describe("pendingTags", () => {
  it("counts everything as pending on an empty database", () => {
    expect(pendingTags(JOURNAL, null)).toEqual(["0000_first", "0001_second", "0002_third"]);
  });

  /**
   * The same rule drizzle's migrator uses — strictly newer than the newest
   * applied. A different rule here would either take the lock for nothing or
   * report "up to date" over work the migrator was about to do.
   */
  it("counts only what is newer than the newest applied", () => {
    expect(pendingTags(JOURNAL, 200)).toEqual(["0002_third"]);
  });

  it("reports nothing when the database is current", () => {
    expect(pendingTags(JOURNAL, 300)).toEqual([]);
    expect(pendingTags(JOURNAL, 400)).toEqual([]);
  });

  it("orders by time rather than by however the journal was written", () => {
    const shuffled = [JOURNAL[2], JOURNAL[0], JOURNAL[1]] as JournalEntry[];
    expect(pendingTags(shuffled, null)).toEqual(["0000_first", "0001_second", "0002_third"]);
  });
});

describe("readJournal", () => {
  it("reads this package's own migrations", () => {
    const entries = readJournal(new URL("../migrations", import.meta.url).pathname);

    expect(entries.length).toBeGreaterThan(0);
    expect(entries[0]).toMatchObject({ idx: 0, tag: "0000_auth_and_settings" });
  });
});
