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

export function poolConfig(url: string, override?: string): PoolConfig {
  return {
    connectionString: url,
    ssl: sslConfig(resolveSslMode(url, override)),
    // A serverless invocation holds a connection for milliseconds and a pooler
    // charges for every one of them. Small ceiling, quick reaping.
    max: poolMax(poolerMode(url)),
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
    // A query with no ceiling is a pooler slot with no ceiling. Client-side on
    // purpose: `statement_timeout` travels as a startup parameter, and a pooler
    // is entitled to refuse those. Generous enough that only a stuck query
    // reaches it.
    query_timeout: 30_000,
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
