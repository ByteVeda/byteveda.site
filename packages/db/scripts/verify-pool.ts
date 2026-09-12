/**
 * Proves that nothing stays connected once the queries are done.
 *
 * The claim is not testable in CI — it needs a real server, and what it asserts
 * is about wall-clock time — so it lives here, next to the code it is about.
 *
 *   DATABASE_URL=postgresql://postgres:pw@localhost:55434/app DATABASE_SSL=disable \
 *     node --import tsx scripts/verify-pool.ts
 *
 * Read-only. Safe against any database, including production, though it does
 * open `DATABASE_POOL_MAX` connections for a moment.
 */
import { sql } from "drizzle-orm";
import { Client } from "pg";
import { closeDb, getDb, poolConfig, poolStats } from "../src/index";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Backends this process has open, counted by the server rather than by us.
 *
 * `poolStats` is what the client believes. This is what the database — and
 * therefore the ceiling — actually sees. They should agree; the point of asking
 * twice is the case where they do not.
 *
 * On its own short-lived connection, excluded from its own count.
 */
async function backendsOnServer(): Promise<number> {
  const observer = new Client(poolConfig(process.env.DATABASE_URL ?? ""));
  await observer.connect();

  try {
    const { rows } = await observer.query<{ open: string }>(
      `select count(*)::int as open from pg_stat_activity
       where datname = current_database()
         and pid <> pg_backend_pid()
         and backend_type = 'client backend'`,
    );
    return Number(rows[0]?.open ?? 0);
  } finally {
    await observer.end();
  }
}

let failures = 0;

function check(what: string, ok: boolean, detail: string) {
  if (!ok) failures += 1;
  console.log(`${ok ? "pass" : "FAIL"}  ${what}  (${detail})`);
}

async function main() {
  const config = poolConfig(process.env.DATABASE_URL ?? "");
  const idle = Number(config.idleTimeoutMillis ?? 0);
  const max = Number(config.max ?? 0);

  console.log(`pool: max ${max}, idle timeout ${idle}ms\n`);

  const db = getDb();
  check(
    "nothing is open before the first query",
    poolStats().total === 0,
    JSON.stringify(poolStats()),
  );

  // A page render: several reads at once, which is what opens more than one
  // connection in the first place.
  await Promise.all(Array.from({ length: max }, () => db.execute(sql`select 1`)));

  const afterQueries = poolStats();
  check(
    "the burst opened connections and gave them all back",
    afterQueries.total > 0 &&
      afterQueries.idle === afterQueries.total &&
      afterQueries.waiting === 0,
    JSON.stringify(afterQueries),
  );
  check(
    "and never opened more than the ceiling",
    afterQueries.total <= max,
    `${afterQueries.total} <= ${max}`,
  );

  // Halfway through the idle window: still pooled, which is the point of a pool.
  // A second request arriving now reuses these rather than paying for a TLS
  // handshake across the Pacific.
  await wait(Math.max(idle / 2, 1));
  check(
    "they are still pooled while the window is open",
    poolStats().total === afterQueries.total,
    JSON.stringify(poolStats()),
  );

  await db.execute(sql`select 1`);
  check(
    "and a later query reuses one rather than opening another",
    poolStats().total === afterQueries.total,
    JSON.stringify(poolStats()),
  );

  // Asked once and reused: a second call would open a second observer
  // connection and could answer about a different moment than it asserted on.
  const openBackends = await backendsOnServer();
  check(
    "and the server agrees they are open",
    openBackends === afterQueries.total,
    `${openBackends} backends`,
  );

  // Past it: the instance has gone quiet, and the pooler has its slots back.
  await wait(idle + 1_000);
  const afterIdle = poolStats();
  check("nothing is held once the window closes", afterIdle.total === 0, JSON.stringify(afterIdle));
  const remainingBackends = await backendsOnServer();
  check(
    "and the server sees them gone, not merely unused",
    remainingBackends === 0,
    `${remainingBackends} backends`,
  );

  console.log(failures === 0 ? "\nPASS" : `\nFAIL: ${failures} check(s)`);
  if (failures > 0) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(closeDb);
