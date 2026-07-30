/**
 * Commission module — dedicated database connection.
 *
 * Reads COMMISSION_DATABASE_URL exclusively. This variable must point to the
 * shared FinanceOS Neon/PostgreSQL financial model (project: financeos,
 * branch: production, database: neondb) using a Commission-scoped write role
 * that has SELECT on public.entities and public.invoices plus full DML on the
 * seven commission_* tables only.
 *
 * DATABASE_URL  — never read here (Dashboard operational DB / heliumdb).
 * CORE_DATABASE_URL — never read here (Core is read-only via @workspace/db).
 *
 * Two entry points:
 *   getCommissionOpsDb()         — used by production code (lazy singleton).
 *   _injectCommissionDbForTest() — used by the CI integration harness only.
 */

import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";

const { Pool } = pg;

type CommissionDb = ReturnType<typeof drizzle>;

let _singleton: CommissionDb | null = null;

/**
 * Returns the Commission database connection backed by COMMISSION_DATABASE_URL.
 * Fails loudly if the variable is absent — no fallback to DATABASE_URL or
 * CORE_DATABASE_URL. The connection string is never logged.
 */
export function getCommissionOpsDb(): CommissionDb {
  if (_singleton) return _singleton;
  const url = process.env.COMMISSION_DATABASE_URL;
  if (!url) {
    throw new Error(
      "COMMISSION_DATABASE_URL must be set. " +
      "Commission operations require the shared FinanceOS Neon database. " +
      "Do not use DATABASE_URL (Dashboard operational DB) or CORE_DATABASE_URL (read-only Core)."
    );
  }
  _singleton = drizzle(new Pool({ connectionString: url }));
  return _singleton;
}

/**
 * Injects a test connection before the singleton is created.
 * Called by the CI integration test harness only; never by production code.
 * Allows commission functions to run against a CI-ephemeral database
 * without setting any production connection string.
 */
export function _injectCommissionDbForTest(db: CommissionDb): void {
  _singleton = db;
}
