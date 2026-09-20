/**
 * Applies pending migrations, as a deploy step.
 *
 *   node --import tsx scripts/migrate.ts
 *
 * Run by the build of every app that talks to Postgres — see the `build` script
 * in each of their package.json — so that a release and its schema arrive
 * together. Nothing about it is Vercel-specific: it reads the environment, takes
 * a lock, applies what is missing, and exits non-zero if it could not. Any
 * platform that runs a build command can run it, and `DATABASE_MIGRATE=force`
 * makes it usable from a release step on one that does not build at all.
 *
 * What it will not do is migrate quietly. Every outcome is a line on stdout
 * naming the database and the migrations, because the failure this exists to
 * prevent was invisible: a migration applied to the wrong project, and a table
 * that was missing until a visitor found it.
 *
 * Safe to run on every build. With nothing pending it is one connection and two
 * queries, and it does not take the lock at all.
 */

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Client } from "pg";
import { poolConfig } from "../src/client";
import {
  describeTarget,
  migrationPolicy,
  pendingTags,
  readJournal,
  sessionUrl,
} from "../src/deploy";

const MIGRATIONS = join(dirname(fileURLToPath(import.meta.url)), "..", "migrations");

/**
 * Arbitrary, fixed, and shared by everything that migrates this database.
 *
 * Two apps deploying at once both read the journal, both find the same
 * migration pending, and both try to apply it; the loser's transaction rolls
 * back on a duplicate object and takes a green deploy down with it. The lock
 * turns that race into a short wait. The number means nothing beyond "these two
 * processes agree on it" — never change it, or the agreement is gone.
 */
const LOCK_ID = 1_818_326_887;

/**
 * Long enough for a slow migration on the other side of the world to finish,
 * short enough that a lock nobody will release fails the build rather than
 * hanging it until the platform's own timeout.
 */
const LOCK_TIMEOUT_MS = 120_000;

const MIGRATIONS_TABLE = "drizzle.__drizzle_migrations";

/** Epoch milliseconds of the newest applied migration; null before the first. */
async function lastAppliedAt(client: Client): Promise<number | null> {
  const { rows: exists } = await client.query<{ present: boolean }>(
    "select to_regclass($1) is not null as present",
    [MIGRATIONS_TABLE],
  );
  if (!exists[0]?.present) return null;

  const { rows } = await client.query<{ last: string | null }>(
    `select max(created_at)::text as last from ${MIGRATIONS_TABLE}`,
  );
  const last = rows[0]?.last;
  return last === null || last === undefined ? null : Number(last);
}

async function main(): Promise<void> {
  const policy = migrationPolicy(process.env);
  if (!policy.run) {
    console.log(`[migrate] skipped — ${policy.reason}`);
    return;
  }

  const url = sessionUrl(policy.url);
  const target = describeTarget(url);
  if (url !== policy.url) {
    console.log(`[migrate] ${describeTarget(policy.url)} is a transaction pooler; using ${target}`);
  }

  const journal = readJournal(MIGRATIONS);
  const client = new Client(poolConfig(url));
  await client.connect();

  try {
    const pending = pendingTags(journal, await lastAppliedAt(client));
    if (pending.length === 0) {
      console.log(`[migrate] ${target} is up to date (${journal.length} migrations)`);
      return;
    }

    console.log(`[migrate] ${target} is missing ${pending.length}: ${pending.join(", ")}`);

    await client.query(`set lock_timeout = ${LOCK_TIMEOUT_MS}`);
    await client.query("select pg_advisory_lock($1)", [LOCK_ID]);

    try {
      // Asked again now that nothing else can be applying: the first read raced
      // whatever else is deploying, and the winner of that race has left less to
      // do than it found.
      const remaining = pendingTags(journal, await lastAppliedAt(client));
      if (remaining.length === 0) {
        console.log("[migrate] another build applied them first; nothing to do");
        return;
      }

      await migrate(drizzle(client), { migrationsFolder: MIGRATIONS });
      console.log(`[migrate] applied ${remaining.length}: ${remaining.join(", ")}`);
    } finally {
      await client.query("select pg_advisory_unlock($1)", [LOCK_ID]);
    }
  } finally {
    await client.end();
  }
}

main().catch((cause) => {
  // The build must not continue. A deploy whose schema did not land is a deploy
  // that will fail in front of somebody instead.
  console.error("[migrate] failed:", cause);
  process.exitCode = 1;
});
