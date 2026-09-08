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

export function poolConfig(url: string, override?: string): PoolConfig {
  return {
    connectionString: url,
    ssl: sslConfig(resolveSslMode(url, override)),
    // A serverless invocation holds a connection for milliseconds and a pooler
    // charges for every one of them. Small ceiling, quick reaping.
    max: Number(process.env.DATABASE_POOL_MAX ?? 5),
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
  };
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

export function getPool(): Pool {
  if (!globalForDb.__bytevedaPool) {
    const pool = new Pool(poolConfig(connectionString()));
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
