import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool, type PoolConfig } from "pg";
import * as schema from "./schema";

export type Database = NodePgDatabase<typeof schema>;

/**
 * How to treat TLS on the way to Postgres. Deliberately explicit rather than
 * inferred from a provider name — this package must work against RDS, a managed
 * pooler, a VPS, or a container without knowing which it is talking to.
 *
 * - `require`   TLS, certificate verified. The correct production setting.
 * - `no-verify` TLS, certificate not verified. For providers whose pooler
 *               presents a certificate Node's trust store rejects.
 * - `disable`   No TLS. Local development only.
 */
export type SslMode = "require" | "no-verify" | "disable";

const SSL_MODES: readonly SslMode[] = ["require", "no-verify", "disable"];

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "0.0.0.0"]);

function hostOf(url: string): string | undefined {
  try {
    return new URL(url).hostname;
  } catch {
    return undefined;
  }
}

/**
 * `DATABASE_SSL` wins when set. Otherwise a local host means no TLS and
 * anything else means TLS, which is the safe default for a connection string
 * that points off the machine.
 */
export function resolveSslMode(url: string, override = process.env.DATABASE_SSL): SslMode {
  if (override) {
    const mode = override.trim().toLowerCase();
    if (!SSL_MODES.includes(mode as SslMode)) {
      throw new Error(`DATABASE_SSL must be one of ${SSL_MODES.join(", ")} — got "${override}"`);
    }
    return mode as SslMode;
  }

  const host = hostOf(url);
  return host && LOCAL_HOSTS.has(host) ? "disable" : "require";
}

function sslConfig(mode: SslMode): PoolConfig["ssl"] {
  switch (mode) {
    case "disable":
      return false;
    case "no-verify":
      return { rejectUnauthorized: false };
    case "require":
      return { rejectUnauthorized: true };
  }
}

/**
 * How a connection string reaches Postgres.
 *
 * - `transaction` A pooler that hands the server connection back at the end of
 *                 each transaction. Hundreds of clients share a handful of
 *                 connections, which is the only shape that suits serverless.
 * - `session`     A pooler that pins a server connection for as long as the
 *                 client stays connected. The ceiling counts *clients*.
 * - `direct`      Straight to Postgres, or to something this cannot identify.
 */
export type PoolerMode = "transaction" | "session" | "direct";

/**
 * Supabase's pooler, by port. The one vendor check in this package.
 *
 * It earns its place because the failure it prevents is silent until it is
 * total: session mode on Supavisor allows fifteen clients across every consumer
 * of this package — both Vercel projects, every warm instance of each, local
 * development, and drizzle-kit — and the sixteenth does not get a slow query or
 * a degraded page. It gets `XX000 (EMAXCONNSESSION)`, and the console is down.
 *
 * Supavisor puts session mode on 5432 and transaction mode on 6543. Nothing in
 * the protocol announces which one answered, so the port is the only signal
 * available before the first connection.
 */
export function poolerMode(url: string): PoolerMode {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return "direct";
  }

  if (!parsed.hostname.endsWith(".pooler.supabase.com")) return "direct";
  return parsed.port === "6543" ? "transaction" : "session";
}

/**
 * Connections per instance.
 *
 * Five against a transaction-mode pooler or a database of our own: enough for
 * the parallel reads a page issues, and small enough that a dozen warm
 * instances are not a problem.
 *
 * Two against session mode, where every one of them is held for the life of the
 * process and counts against a ceiling shared with everything else. It costs a
 * little latency on the pages that read in parallel. It buys seven instances of
 * headroom instead of three, which is the difference between the console being
 * slow and the console being down.
 */
function poolMax(mode: PoolerMode): number {
  const override = Number(process.env.DATABASE_POOL_MAX);
  if (Number.isFinite(override) && override > 0) return override;

  return mode === "session" ? 2 : 5;
}

/**
 * How long a connection may sit unused before it is given back.
 *
 * This is the only thing that keeps a connection alive after a request is over.
 * Nothing in this repo checks a client out by hand — every read goes through
 * `pool.query`, which releases in a `finally`, and the one `transaction()` is
 * drizzle's, which does the same — so a request cannot leak a connection. What
 * it *can* do is leave one idle in the pool, and a warm serverless instance can
 * then sit on it for as long as this allows while serving nobody.
 *
 * Two seconds rather than ten. A page render issues its handful of queries
 * inside a few hundred milliseconds and a click follows within one, so a burst
 * still reuses the same connection; an instance that has gone quiet gives
 * everything back almost immediately. The cost of getting it wrong in the other
 * direction is a TCP and TLS handshake to Tokyo, which is why this is not
 * shorter still.
 */
function idleMs(): number {
  const override = Number(process.env.DATABASE_POOL_IDLE_MS);

  // Zero is rejected rather than honoured. In node-postgres it means "never
  // disconnect an idle client", not "disconnect it immediately" — so the one
  // value somebody would reach for to hold connections for the shortest
  // possible time is the value that holds them forever. Measured, not assumed:
  // `scripts/verify-pool.ts` at 0 leaves five backends open on the server.
  return Number.isFinite(override) && override > 0 ? override : 2_000;
}

export function poolConfig(url: string, override?: string): PoolConfig {
  return {
    connectionString: url,
    ssl: sslConfig(resolveSslMode(url, override)),
    // A serverless invocation holds a connection for milliseconds and a pooler
    // charges for every one of them. Small ceiling, quick reaping.
    max: poolMax(poolerMode(url)),
    idleTimeoutMillis: idleMs(),
    connectionTimeoutMillis: 10_000,
    // A query with no ceiling is a pooler slot with no ceiling. Client-side on
    // purpose: `statement_timeout` travels as a startup parameter, and a pooler
    // is entitled to refuse those. Generous enough that only a stuck query
    // reaches it.
    query_timeout: 30_000,
    // A ceiling on how long any one connection may exist, however busy it is.
    // `idleTimeoutMillis` never fires on a connection that is used just often
    // enough to stay warm, so without this a long-lived instance can hold the
    // same server connection indefinitely. Recycled on release, never mid-query.
    maxLifetimeSeconds: 600,
    // Lets a script exit when its work is done rather than waiting out
    // `idleTimeoutMillis`. The server never idles long enough to notice.
    allowExitOnIdle: true,
  };
}

/**
 * Whether a connection string exists at all.
 *
 * Lets a consumer tell "nobody configured a database" from "the database is
 * down" — the first is a build running without secrets, the second is an
 * incident. They deserve different behaviour.
 */
export function isConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

/**
 * Whether this process is `next build` rather than a running server.
 *
 * The third case a caller has to tell apart. A read that fails on a live server
 * is an incident and should surface as one; the same read failing while a page
 * is being prerendered would take the whole deploy with it, and a deploy should
 * not depend on the database being up at the moment it runs.
 *
 * `NEXT_PHASE` is set by Next in the build process and its prerender workers —
 * `phase-production-build`, from `next/constants`. Inlined as a literal rather
 * than imported so this package stays usable from a plain script.
 */
export function isBuildPhase(): boolean {
  return process.env.NEXT_PHASE === "phase-production-build";
}

function connectionString(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env.local and fill in a Postgres connection string.",
    );
  }
  return url;
}

/** Cached across Next's dev-server module reloads, which would otherwise leak a pool per edit. */
const globalForDb = globalThis as typeof globalThis & {
  __bytevedaPool?: Pool;
  __bytevedaDb?: Database;
};

/**
 * Says once, at the point the first connection is opened, that this process is
 * pinning a shared ceiling.
 *
 * Logged rather than thrown. Session mode is the right answer for a migration
 * and the only answer for a local Postgres, so refusing to start would break
 * both to protect a deployment neither of them is.
 */
function warnAboutSessionMode(url: string): void {
  if (poolerMode(url) !== "session") return;

  const where = hostOf(url) ?? "the pooler";
  console.warn(
    `[db] ${where}:5432 is Supabase's session-mode pooler: every connection is held for the life of this process, and the ceiling is fifteen clients across every project, instance and developer sharing this database. Point DATABASE_URL at port 6543 for transaction mode. Keep 5432 for drizzle-kit.`,
  );
}

export function getPool(): Pool {
  if (!globalForDb.__bytevedaPool) {
    const url = connectionString();
    warnAboutSessionMode(url);

    const pool = new Pool(poolConfig(url));
    // An idle client erroring out (pooler restart, network blip) emits on the
    // pool. Unhandled, it takes the process down.
    pool.on("error", (error) => {
      console.error("[db] idle client error", error);
    });
    globalForDb.__bytevedaPool = pool;
  }
  return globalForDb.__bytevedaPool;
}

/** What this process is holding right now. */
export type PoolStats = {
  /** Connections open, busy or idle. What the pooler's ceiling counts. */
  total: number;
  /** Open and unused. These go back once `idleTimeoutMillis` elapses. */
  idle: number;
  /** Callers queued because every connection is busy. Sustained, raise `max`. */
  waiting: number;
};

/**
 * The pool, from outside.
 *
 * Exists to make "is anything still held?" answerable rather than argued about
 * — by a script after a request, or by a route when someone is looking into a
 * connection ceiling. Reads counters; opens nothing.
 */
export function poolStats(): PoolStats {
  const pool = globalForDb.__bytevedaPool;
  if (!pool) return { total: 0, idle: 0, waiting: 0 };

  return { total: pool.totalCount, idle: pool.idleCount, waiting: pool.waitingCount };
}

/**
 * The Drizzle client. Import this in the admin app; the public sites should use
 * the read-only helpers in `queries/` instead.
 */
export function getDb(): Database {
  if (!globalForDb.__bytevedaDb) {
    globalForDb.__bytevedaDb = drizzle(getPool(), { schema });
  }
  return globalForDb.__bytevedaDb;
}

/** Releases the pool. For scripts and tests; the server never calls this. */
export async function closeDb(): Promise<void> {
  await globalForDb.__bytevedaPool?.end();
  globalForDb.__bytevedaPool = undefined;
  globalForDb.__bytevedaDb = undefined;
}
