/**
 * Drizzle operational config — DATABASE_URL (Replit PostgreSQL-16, db "heliumdb").
 *
 * Used by `pnpm --filter db push:ops` and `scripts/post-merge.sh`.
 * Targets ONLY Dashboard-owned tables: session, metric_snapshots, budgets,
 * report_history. Core Neon tables are intentionally excluded.
 *
 * NEVER point this config at CORE_DATABASE_URL. Core tables belong to the
 * read-only Neon database and must never be provisioned via this path.
 *
 * drizzle.config.ts (the sibling file) targets the full schema for migration
 * file generation — it does NOT run push and is NOT used in post-merge.
 */
import { defineConfig } from "drizzle-kit";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set. It is the writable Replit operational database.");
}

export default defineConfig({
  schema:      "./src/schema/ops.ts",
  out:         "./drizzle/migrations-ops",
  dialect:     "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
