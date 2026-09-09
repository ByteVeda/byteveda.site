import { defineConfig } from "drizzle-kit";
import { resolveSslMode } from "./src/client";

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error("DATABASE_URL is not set. drizzle-kit needs it to diff and apply migrations.");
}

// drizzle-kit takes an ssl flag rather than a pg pool config, so the shared
// policy in client.ts is translated here rather than duplicated.
const ssl = {
  require: true as const,
  "no-verify": { rejectUnauthorized: false },
  disable: false as const,
}[resolveSslMode(url)];

export default defineConfig({
  schema: "./src/schema/index.ts",
  out: "./migrations",
  dialect: "postgresql",
  dbCredentials: { url, ssl },
  casing: "snake_case",
  verbose: true,
  strict: true,
});
