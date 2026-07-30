/**
 * Operational database connection — DATABASE_URL only.
 *
 * This module creates a drizzle opsDb from DATABASE_URL without importing
 * from @workspace/db, which would also load the CORE_DATABASE_URL pool
 * (FinanceOS Neon Core). Commission functions only need the writable ops
 * database and must never have a runtime dependency on Core.
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
 * Returns the operational DB connection for commission functions.
 * Reads DATABASE_URL on first call; CORE_DATABASE_URL is never touched.
 */
export function getCommissionOpsDb(): CommissionDb {
  if (_singleton) return _singleton;
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL must be set. Commission operations require the writable ops database."
    );
  }
  _singleton = drizzle(new Pool({ connectionString: url }));
  return _singleton;
}

/**
 * Injects a test connection before the singleton is created.
 * Called by the CI integration test harness; never by production code.
 * Allows commission functions to run against a CI-ephemeral database
 * without setting CORE_DATABASE_URL.
 */
export function _injectCommissionDbForTest(db: CommissionDb): void {
  _singleton = db;
}
