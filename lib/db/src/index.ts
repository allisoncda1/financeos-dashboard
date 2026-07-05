import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

// Financial reads go to FinanceOS Core's read-only Neon database via
// CORE_DATABASE_URL. This is deliberately separate from DATABASE_URL, which is
// the Dashboard's own operational database (sessions, metric_snapshots). The
// Dashboard must never write to Core, and no session/UI tables live in Core.
if (!process.env.CORE_DATABASE_URL) {
  throw new Error(
    "CORE_DATABASE_URL must be set. It is the read-only Neon connection for FinanceOS Core financial data (portfolio_snapshots, entity_snapshots, financial_periods, validation_results, sync_runs).",
  );
}

export const pool = new Pool({
  connectionString: process.env.CORE_DATABASE_URL,
});
export const db = drizzle(pool, { schema });

export * from "./schema";
