/**
 * Deciding whether a build is allowed to migrate, and what is left to apply.
 *
 * The reason any of this exists: `academy.sample_requests` shipped in a release
 * whose migration was never run against the database the site connects to. The
 * table was missing for as long as nobody filed a sample request, and the first
 * person who did got a 503. A migration that has to be remembered is a
 * migration that will be forgotten, so the build runs it.
 *
 * Everything here is a pure function of the environment and the migrations
 * folder. The connecting, locking and applying live in `scripts/migrate.ts`;
 * the decisions live here because they are the part worth testing.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { poolerMode } from "./client";

/** One row of drizzle's `meta/_journal.json`. */
export type JournalEntry = {
  idx: number;
  /** Epoch milliseconds. Drizzle applies by this, not by filename order. */
  when: number;
  tag: string;
};

export type Decision =
  | { run: true; url: string }
  /** Why nothing will be applied. Always logged — a silent skip is the bug. */
  | { run: false; reason: string };

/**
 * A deployment platform, as far as this file needs to know one.
 *
 * `detect` answers "is this build running on you", `isProduction` answers "is
 * this the deployment of record". Both matter: a preview build runs the code of
 * a branch that nobody has merged, and letting it migrate would apply an
 * unreviewed migration to whatever database its environment happens to name —
 * which, on a project that gives preview and production the same `DATABASE_URL`,
 * is production.
 *
 * Adding a platform is adding a row. A platform that is not listed is not
 * recognised, and an unrecognised build is trusted: a CI job, a container, or a
 * machine with `DATABASE_URL` exported has chosen its database deliberately.
 * `DATABASE_MIGRATE=force` covers the case where that guess is wrong.
 */
type Platform = {
  name: string;
  detect(env: NodeJS.ProcessEnv): boolean;
  isProduction(env: NodeJS.ProcessEnv): boolean;
};

const PLATFORMS: readonly Platform[] = [
  {
    name: "Vercel",
    detect: (env) => Boolean(env.VERCEL),
    // "production", "preview" or "development". Set by Vercel on every build.
    isProduction: (env) => env.VERCEL_ENV === "production",
  },
];

/** Values of `DATABASE_MIGRATE` that mean "not on this build". */
const OFF = new Set(["off", "0", "false", "no"]);
/** Values that mean "yes, whatever you think you have detected". */
const FORCE = new Set(["force", "on", "1", "true", "yes"]);

/**
 * Whether this build should apply migrations, and against what.
 *
 * `DATABASE_MIGRATE_URL` exists for the common split where the connection the
 * app uses is not the connection migrations want — a transaction-mode pooler is
 * the right runtime choice and the wrong place to hold a lock. Unset, the app's
 * own `DATABASE_URL` is used and `sessionUrl` sorts out the pooler.
 */
export function migrationPolicy(env: NodeJS.ProcessEnv = process.env): Decision {
  const url = env.DATABASE_MIGRATE_URL?.trim() || env.DATABASE_URL?.trim();
  const flag = env.DATABASE_MIGRATE?.trim().toLowerCase();

  if (flag && OFF.has(flag)) return { run: false, reason: "DATABASE_MIGRATE is off" };

  if (!url) {
    return {
      run: false,
      reason:
        "neither DATABASE_MIGRATE_URL nor DATABASE_URL is set, so there is nothing to migrate",
    };
  }

  if (flag && FORCE.has(flag)) return { run: true, url };
  if (flag) {
    throw new Error(
      `DATABASE_MIGRATE must be one of force, off — got "${env.DATABASE_MIGRATE}". Leave it unset to decide by platform.`,
    );
  }

  const platform = PLATFORMS.find((candidate) => candidate.detect(env));
  if (platform && !platform.isProduction(env)) {
    return {
      run: false,
      reason: `this is not a production ${platform.name} build; set DATABASE_MIGRATE=force to override`,
    };
  }

  return { run: true, url };
}

/**
 * The connection to migrate over, given the one that was configured.
 *
 * Migrations are guarded by a session-level advisory lock, and a session-level
 * anything needs a connection that stays the same between statements. Supabase's
 * transaction-mode pooler on 6543 does not give one — it hands the server
 * connection back at the end of every transaction, so the lock would be taken on
 * one backend and released on another, or on none. Port 5432 on the same host is
 * session mode, which is what the repo already reserves for drizzle-kit.
 *
 * The one vendor rule in `client.ts` is reused rather than a second one written.
 * Anything it does not recognise is returned untouched: a direct connection is
 * already a session.
 */
export function sessionUrl(url: string): string {
  if (poolerMode(url) !== "transaction") return url;

  const parsed = new URL(url);
  parsed.port = "5432";
  return parsed.toString();
}

/** `host:port/database`, which is what a log may say about a connection string. */
export function describeTarget(url: string): string {
  try {
    const { hostname, port, pathname } = new URL(url);
    return `${hostname}${port ? `:${port}` : ""}${pathname}`;
  } catch {
    return "an unparseable connection string";
  }
}

/**
 * The migrations in the folder that the database has not run.
 *
 * Deliberately the same rule drizzle's migrator applies — everything newer than
 * the newest applied `created_at` — because the point of asking first is to know
 * whether to take the lock at all, and an answer that disagreed with the migrator
 * would either lock for nothing or skip work that was pending. It is also what
 * gets logged, which is the difference between "migrations ran" and knowing
 * which ones.
 */
export function pendingTags(
  entries: readonly JournalEntry[],
  lastAppliedAt: number | null,
): string[] {
  const ordered = [...entries].sort((a, b) => a.when - b.when);
  if (lastAppliedAt === null) return ordered.map((entry) => entry.tag);

  return ordered.filter((entry) => entry.when > lastAppliedAt).map((entry) => entry.tag);
}

/** Drizzle's journal, which is the list of migrations that exist. */
export function readJournal(migrationsFolder: string): JournalEntry[] {
  const path = join(migrationsFolder, "meta", "_journal.json");
  const journal = JSON.parse(readFileSync(path, "utf8")) as { entries?: JournalEntry[] };
  return journal.entries ?? [];
}
