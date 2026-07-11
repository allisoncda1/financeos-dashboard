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

// Writable operational database (Replit-provisioned, DATABASE_URL). Holds
// Dashboard-owned tables: sessions, metric_snapshots, budgets. Budgets must
// never be written to Core, which is read-only.
if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. It is the writable operational database for Dashboard-owned tables (sessions, metric_snapshots, budgets).",
  );
}
export const opsPool = new Pool({
  connectionString: process.env.DATABASE_URL,
});
export const opsDb = drizzle(opsPool, { schema });

export * from "./schema";
