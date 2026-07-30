#!/usr/bin/env tsx
/**
 * Commission module — CI-only PostgreSQL integration runner
 *
 * PURPOSE
 * -------
 * Validates createCommissionRule, upsertCommissionLine, and lockCommissionPeriod
 * against a real PostgreSQL instance. Intended exclusively for GitHub Actions —
 * not for local developer use. No local database, no Docker on developer Mac,
 * no Homebrew, no Postgres.app.
 *
 * HOW IT WORKS IN CI
 * ------------------
 * The GitHub Actions workflow (commission-postgres-integration.yml) spins up a
 * postgres:16 service container and exposes it at 127.0.0.1:5432 with a database
 * named commission_test_ci. The workflow sets TEST_DATABASE_URL accordingly, then
 * runs this script via: pnpm test:commissions:pg
 *
 * DATABASE_URL is set to TEST_DATABASE_URL inside this script so that
 * getCommissionOpsDb() (ops-connection.ts) connects to the ephemeral CI database.
 * CORE_DATABASE_URL is never set and never needed — commission functions use only
 * the operational database (DATABASE_URL) and do not query FinanceOS Neon Core.
 *
 * WHAT IS NOT USED
 * ----------------
 * - DATABASE_URL from the environment (the real ops database)
 * - CORE_DATABASE_URL (Neon Core — never read by commission functions)
 * - Any FinanceOS production connection string
 * - Any QBO connection
 *
 * EXIT CODE
 * ---------
 * 0 — all tests passed.
 * 1 — first failed test, missing env var, wrong database name, or unexpected error.
 */

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import pg from "pg";

const { Pool, Client } = pg;

// ─── CI context guard ──────────────────────────────────────────────────────
// Prevents accidental execution outside CI.

const IS_CI = process.env.GITHUB_ACTIONS === "true" || process.env.CI === "true";
if (!IS_CI) {
  console.error("❌  This script runs only in CI (GITHUB_ACTIONS=true or CI=true).");
  console.error("    PostgreSQL integration for the Commission module is gated");
  console.error("    by GitHub Actions — see .github/workflows/commission-postgres-integration.yml.");
  console.error("    No local database setup is supported or required.");
  process.exit(1);
}

// ─── URL utilities ─────────────────────────────────────────────────────────

interface NormalizedUrl {
  host: string;
  port: number;
  database: string;
}

function normalizeUrl(raw: string): NormalizedUrl | null {
  try {
    const u = new URL(raw);
    const host = (u.hostname === "localhost" ? "127.0.0.1" : u.hostname).toLowerCase();
    return {
      host,
      port:     parseInt(u.port || "5432", 10),
      database: decodeURIComponent(u.pathname.replace(/^\//, "")),
    };
  } catch {
    return null;
  }
}

function sameDestination(a: NormalizedUrl, b: NormalizedUrl): boolean {
  return a.host === b.host && a.port === b.port && a.database === b.database;
}

function maskUrl(raw: string): string {
  try {
    const u = new URL(raw);
    u.password = "***";
    u.username = u.username ? "***" : "";
    return u.toString();
  } catch {
    return "<invalid url>";
  }
}

// ─── Environment guards ────────────────────────────────────────────────────

const TEST_URL = process.env.TEST_DATABASE_URL;
if (!TEST_URL) {
  console.error("❌  TEST_DATABASE_URL is not set.");
  console.error("    The GitHub Actions workflow sets this from the postgres service container.");
  process.exit(1);
}

const testNorm = normalizeUrl(TEST_URL);
if (!testNorm) {
  console.error("❌  TEST_DATABASE_URL is not a valid URL:", maskUrl(TEST_URL));
  process.exit(1);
}

// Enforce a strict database name prefix to prevent targeting any real database.
if (!testNorm.database.startsWith("commission_test_ci")) {
  console.error(`❌  Database must be named "commission_test_ci" or "commission_test_ci_*".`);
  console.error(`    Got: "${testNorm.database}"`);
  process.exit(1);
}

// Cross-check against any real database URLs present in the environment.
// Normalizing host + port + database catches localhost vs 127.0.0.1 variants.
for (const [name, raw] of [
  ["DATABASE_URL",      process.env.DATABASE_URL],
  ["CORE_DATABASE_URL", process.env.CORE_DATABASE_URL],
] as [string, string | undefined][]) {
  if (!raw) continue;
  const norm = normalizeUrl(raw);
  if (norm && sameDestination(testNorm, norm)) {
    console.error(`❌  TEST_DATABASE_URL resolves to the same host/port/database as ${name}.`);
    console.error("    Refusing — would write to a real FinanceOS database.");
    process.exit(1);
  }
}

// ─── Inject test database into commission ops connection ───────────────────
//
// Sets DATABASE_URL to TEST_DATABASE_URL so that getCommissionOpsDb() in
// ops-connection.ts connects to the ephemeral CI database.
// CORE_DATABASE_URL is intentionally NOT set — commission functions do not need it.
// This is the proof that the Commission module is decoupled from FinanceOS Core.

process.env.DATABASE_URL = TEST_URL;
// CORE_DATABASE_URL is deliberately left unset.

// ─── Paths ─────────────────────────────────────────────────────────────────

const __dirname  = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS = path.resolve(__dirname, "../src/db/migrations");
const SQL_001    = path.join(MIGRATIONS, "commission_001_schema.sql");
const SQL_002    = path.join(MIGRATIONS, "commission_002_attribution_seed.sql");

for (const f of [SQL_001, SQL_002]) {
  if (!fs.existsSync(f)) {
    console.error(`❌  Migration not found: ${f}`);
    process.exit(1);
  }
}

// ─── Test harness ──────────────────────────────────────────────────────────

let passed = 0;
let lastError = "";

async function assert(description: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
    console.log(`  ✓  ${description}`);
    passed++;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`  ✗  ${description}`);
    console.error(`       ${msg}`);
    lastError = msg;
    throw new Error("STOP");
  }
}

function assertEqual<T>(actual: T, expected: T, label: string): void {
  if (actual !== expected)
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

function assertMatch(actual: string, re: RegExp, label: string): void {
  if (!re.test(actual))
    throw new Error(`${label}: "${actual}" does not match ${re}`);
}

async function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout after ${ms}ms: ${label}`)), ms)
    ),
  ]);
}

// ─── Fixed test constants ──────────────────────────────────────────────────

// commission_run_lines.entity_id has no FK — any UUID is valid.
const ENTITY_RULES = "cccccccc-0000-4000-a000-000000000001";
const ENTITY_LOCK  = "dddddddd-0000-4000-a000-000000000001";
const INVOICE_ID   = "aaaaaaaa-0000-4000-a000-000000000001";

const FP_JAN       = "ci-fp-jan";
const FP_DATE_MOVE = "ci-fp-date-move";
const FP_NULL_OK   = "ci-fp-null-ok";
const FP_NULL_LOCK = "ci-fp-null-locked";
const FP_LOCKED    = "ci-fp-locked-period";
const FP_ADV_LOCK  = "ci-fp-advisory-lock-test";

// ─── Main ──────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log("Commission PostgreSQL integration — CI runner");
  console.log(`  Database : ${maskUrl(TEST_URL!)}`);
  console.log(`  CI       : GITHUB_ACTIONS=${process.env.GITHUB_ACTIONS ?? "?"}`);
  console.log(`  Functions: createCommissionRule · upsertCommissionLine · lockCommissionPeriod`);
  console.log(`  CORE_DATABASE_URL: ${process.env.CORE_DATABASE_URL ? "SET (will be cross-checked)" : "NOT SET ✓ (commission functions do not need Core)"}`);
  console.log("");

  // Verification pool (raw SQL — no drizzle, no @workspace/db dependency).
  const pool = new Pool({ connectionString: TEST_URL!, max: 5 });

  // Dynamic import AFTER DATABASE_URL is set so getCommissionOpsDb() initialises
  // against the CI ephemeral database. CORE_DATABASE_URL is not set, proving the
  // module has no runtime dependency on FinanceOS Neon Core.
  const {
    createCommissionRule,
    upsertCommissionLine,
    lockCommissionPeriod,
  } = await import("../src/db/commissions.js");

  try {
    // ── Verify connected database ─────────────────────────────────────────

    const dbCheck = await pool.query<{ current_database: string }>("SELECT current_database()");
    const currentDb = dbCheck.rows[0].current_database;
    if (!currentDb.startsWith("commission_test_ci")) {
      console.error(`❌  Connected to "${currentDb}" — not a commission_test_ci* database. Aborting.`);
      process.exit(1);
    }
    console.log(`  Verified: current_database() = "${currentDb}"`);
    console.log("");

    // Full schema reset — ensures no state leaks across CI reruns on the same container.
    await pool.query("DROP SCHEMA IF EXISTS public CASCADE");
    await pool.query("CREATE SCHEMA public");
    await pool.query("GRANT ALL ON SCHEMA public TO CURRENT_USER");

    // ── 1. Schema and seed ────────────────────────────────────────────────
    console.log("── 1. Schema and seed ─────────────────────────────────────────");

    await assert("commission_001_schema.sql applies without error", async () => {
      await pool.query(fs.readFileSync(SQL_001, "utf8"));
    });

    await assert("commission_002_attribution_seed.sql applies (run 1)", async () => {
      await pool.query(fs.readFileSync(SQL_002, "utf8"));
    });

    await assert("Seed produces exactly 31 attribution rules", async () => {
      const r = await pool.query<{ count: string }>(
        "SELECT COUNT(*)::text AS count FROM commission_attribution_rules"
      );
      assertEqual(r.rows[0].count, "31", "attribution rule count");
    });

    await assert("Seed is idempotent — second run still 31 rows", async () => {
      await pool.query(fs.readFileSync(SQL_002, "utf8"));
      const r = await pool.query<{ count: string }>(
        "SELECT COUNT(*)::text AS count FROM commission_attribution_rules"
      );
      assertEqual(r.rows[0].count, "31", "attribution rule count after second seed run");
    });

    // ── 2. FK and constraint integrity ────────────────────────────────────
    console.log("");
    console.log("── 2. FK and constraint integrity ─────────────────────────────");

    await assert("No orphaned attribution rules (representative FK intact)", async () => {
      const r = await pool.query<{ count: string }>(`
        SELECT COUNT(*)::text AS count
        FROM commission_attribution_rules ar
        LEFT JOIN commission_representatives r ON r.id = ar.representative_id
        WHERE r.id IS NULL
      `);
      assertEqual(r.rows[0].count, "0", "orphaned attribution rules");
    });

    await assert("All four seeded slugs present: house, jerod, jason, big_mouth", async () => {
      const r = await pool.query<{ slug: string }>(
        "SELECT slug FROM commission_representatives WHERE slug IN ('house','jerod','jason','big_mouth') ORDER BY slug"
      );
      for (const slug of ["big_mouth", "house", "jason", "jerod"]) {
        if (!r.rows.find(row => row.slug === slug)) throw new Error(`Missing slug: ${slug}`);
      }
    });

    await assert("commission_periods uses period_year / period_month columns", async () => {
      const r = await pool.query<{ column_name: string }>(`
        SELECT column_name FROM information_schema.columns
        WHERE table_name = 'commission_periods'
          AND column_name IN ('period_year', 'period_month')
        ORDER BY column_name
      `);
      const cols = r.rows.map(row => row.column_name);
      if (!cols.includes("period_year"))  throw new Error("period_year column missing");
      if (!cols.includes("period_month")) throw new Error("period_month column missing");
    });

    await assert("period_month = 13 rejected by check constraint (23514)", async () => {
      let threw = false;
      try {
        await pool.query(
          "INSERT INTO commission_periods (entity_id, period_year, period_month) VALUES ($1::uuid, 2026, 13)",
          [ENTITY_LOCK]
        );
      } catch (e: unknown) {
        threw = true;
        const code = (e as { code?: string }).code;
        if (code !== "23514") throw new Error(`Expected 23514, got ${code}`);
      }
      if (!threw) throw new Error("period_month=13 should have been rejected");
    });

    await assert("commission_periods unique constraint rejects duplicate (entity, year, month)", async () => {
      await pool.query(
        "INSERT INTO commission_periods (entity_id, period_year, period_month) VALUES ($1::uuid, 2026, 1)",
        [ENTITY_LOCK]
      );
      let threw = false;
      try {
        await pool.query(
          "INSERT INTO commission_periods (entity_id, period_year, period_month) VALUES ($1::uuid, 2026, 1)",
          [ENTITY_LOCK]
        );
      } catch (e: unknown) {
        threw = true;
        const code = (e as { code?: string }).code;
        if (code !== "23505") throw new Error(`Expected 23505, got ${code}`);
      }
      if (!threw) throw new Error("Duplicate period should have thrown 23505");
      await pool.query(
        "DELETE FROM commission_periods WHERE entity_id = $1::uuid AND period_year = 2026 AND period_month = 1",
        [ENTITY_LOCK]
      );
    });

    // ── Resolve representative UUIDs from seed ────────────────────────────
    const repRes = await pool.query<{ slug: string; id: string }>(
      "SELECT slug, id::text FROM commission_representatives WHERE slug IN ('jerod','house') ORDER BY slug"
    );
    const repBySlug = Object.fromEntries(repRes.rows.map(r => [r.slug, r.id]));
    const JEROD_ID = repBySlug["jerod"];
    const HOUSE_ID = repBySlug["house"];
    if (!JEROD_ID) throw new Error("Setup: jerod not found after seed");
    if (!HOUSE_ID) throw new Error("Setup: house not found after seed");

    // ── 3. createCommissionRule — production function ─────────────────────
    console.log("");
    console.log("── 3. createCommissionRule ─────────────────────────────────────");

    const baseRule = {
      entityId:         ENTITY_RULES,
      representativeId: JEROD_ID,
      formulaType:      "percentage_of_invoice" as const,
      calculationBasis: "invoice_amount",
      commissionRate:   "0.150000",
      payableTrigger:   "invoice_paid",
      effectiveFrom:    "2026-01-01",
      reason:           "CI integration test",
    };

    let firstRule: Awaited<ReturnType<typeof createCommissionRule>>;
    await assert("Single call → rule version 1, status active", async () => {
      firstRule = await createCommissionRule({ ...baseRule, customerNamePattern: "SingleScope" });
      assertEqual(firstRule.ruleVersion, 1,       "rule version");
      assertEqual(firstRule.status,      "active", "rule status");
    });

    await assert("Audit entry created for the new rule", async () => {
      const r = await pool.query<{ count: string }>(
        "SELECT COUNT(*)::text AS count FROM commission_rule_audit WHERE rule_id = $1::uuid",
        [firstRule.id]
      );
      assertEqual(r.rows[0].count, "1", "audit entry count");
    });

    await assert("Concurrent calls same scope: advisory lock serialises → v1 superseded, v2 active, 2 audit entries", async () => {
      // Both calls use the same opsDb pool backed by TEST_DATABASE_URL.
      // The pg_advisory_xact_lock in createCommissionRule ensures only one transaction
      // runs MAX(version)+1 at a time: v1 is inserted first, then superseded when v2 is created.
      const concurrent = { ...baseRule, customerNamePattern: "ConcurrentScope" };
      await withTimeout(
        Promise.all([createCommissionRule(concurrent), createCommissionRule(concurrent)]),
        10_000,
        "concurrent createCommissionRule"
      );

      const rows = await pool.query<{ rule_version: number; status: string }>(`
        SELECT rule_version, status FROM commission_rules
        WHERE entity_id = $1::uuid AND representative_id = $2::uuid
          AND COALESCE(customer_name_pattern,'') = 'ConcurrentScope'
        ORDER BY rule_version
      `, [ENTITY_RULES, JEROD_ID]);

      assertEqual(rows.rows.length,          2,           "total rows");
      assertEqual(rows.rows[0].rule_version, 1,           "first version");
      assertEqual(rows.rows[0].status,       "superseded", "first status");
      assertEqual(rows.rows[1].rule_version, 2,           "second version");
      assertEqual(rows.rows[1].status,       "active",    "second status");

      const audit = await pool.query<{ count: string }>(`
        SELECT COUNT(*)::text AS count FROM commission_rule_audit
        WHERE rule_id IN (
          SELECT id FROM commission_rules
          WHERE entity_id = $1::uuid AND representative_id = $2::uuid
            AND COALESCE(customer_name_pattern,'') = 'ConcurrentScope'
        )
      `, [ENTITY_RULES, JEROD_ID]);
      assertEqual(audit.rows[0].count, "2", "audit entry count");
    });

    // ── 4. upsertCommissionLine — production function ─────────────────────
    console.log("");
    console.log("── 4. upsertCommissionLine ─────────────────────────────────────");

    const baseLine = {
      entityId:       ENTITY_RULES,
      invoiceId:      INVOICE_ID,
      invoiceQboId:   "QBO-CI",
      lineStatus:     "attributed",
      payoutEligible: false,
    };

    await assert("First ingest (January) → 'created'", async () => {
      const r = await upsertCommissionLine({ ...baseLine, invoiceDate: "2026-01-15", sourceFingerprint: FP_JAN });
      assertEqual(r, "created", "UpsertAction");
    });

    await assert("Re-ingest same fingerprint (January) → 'updated'", async () => {
      const r = await upsertCommissionLine({ ...baseLine, invoiceDate: "2026-01-15", customerName: "Acme", sourceFingerprint: FP_JAN });
      assertEqual(r, "updated", "UpsertAction");
    });

    await assert("January→February date move → 'updated', row reflects February date", async () => {
      await upsertCommissionLine({ ...baseLine, invoiceDate: "2026-01-20", sourceFingerprint: FP_DATE_MOVE });
      const r = await upsertCommissionLine({ ...baseLine, invoiceDate: "2026-02-05", sourceFingerprint: FP_DATE_MOVE });
      assertEqual(r, "updated", "UpsertAction");
      const row = await pool.query<{ invoice_date: string }>(
        "SELECT invoice_date::text FROM commission_run_lines WHERE source_fingerprint = $1", [FP_DATE_MOVE]
      );
      assertMatch(row.rows[0].invoice_date, /^2026-02/, "invoice_date after move");
    });

    await assert("date→null on UNLOCKED period → 'updated', invoice_date becomes null", async () => {
      await upsertCommissionLine({ ...baseLine, invoiceDate: "2026-03-10", sourceFingerprint: FP_NULL_OK });
      const r = await upsertCommissionLine({ ...baseLine, invoiceDate: null, sourceFingerprint: FP_NULL_OK });
      assertEqual(r, "updated", "UpsertAction");
      const row = await pool.query<{ invoice_date: string | null }>(
        "SELECT invoice_date FROM commission_run_lines WHERE source_fingerprint = $1", [FP_NULL_OK]
      );
      assertEqual(row.rows[0].invoice_date, null, "invoice_date is null");
    });

    await assert("date→null on LOCKED period → 'skipped', date unchanged", async () => {
      await upsertCommissionLine({ ...baseLine, invoiceDate: "2026-04-12", sourceFingerprint: FP_NULL_LOCK });
      await pool.query(`
        INSERT INTO commission_periods (entity_id, period_year, period_month, status, locked_by, locked_at)
        VALUES ($1::uuid, 2026, 4, 'locked', 'ci-test', now())
        ON CONFLICT (entity_id, period_year, period_month)
        DO UPDATE SET status = 'locked', locked_at = now()
      `, [ENTITY_RULES]);
      const r = await upsertCommissionLine({ ...baseLine, invoiceDate: null, sourceFingerprint: FP_NULL_LOCK });
      assertEqual(r, "skipped", "UpsertAction");
      const row = await pool.query<{ invoice_date: string }>(
        "SELECT invoice_date::text FROM commission_run_lines WHERE source_fingerprint = $1", [FP_NULL_LOCK]
      );
      assertMatch(row.rows[0].invoice_date, /^2026-04/, "date unchanged");
    });

    await assert("New line into LOCKED period → 'skipped', no row created", async () => {
      await pool.query(`
        INSERT INTO commission_periods (entity_id, period_year, period_month, status, locked_by, locked_at)
        VALUES ($1::uuid, 2026, 5, 'locked', 'ci-test', now())
        ON CONFLICT (entity_id, period_year, period_month)
        DO UPDATE SET status = 'locked', locked_at = now()
      `, [ENTITY_RULES]);
      const r = await upsertCommissionLine({ ...baseLine, invoiceDate: "2026-05-20", sourceFingerprint: FP_LOCKED });
      assertEqual(r, "skipped", "UpsertAction");
      const row = await pool.query<{ count: string }>(
        "SELECT COUNT(*)::text AS count FROM commission_run_lines WHERE source_fingerprint = $1", [FP_LOCKED]
      );
      assertEqual(row.rows[0].count, "0", "no row created");
    });

    await assert("Advisory lock: external client holds source_fingerprint lock → upsertCommissionLine blocks until released", async () => {
      // An external pg.Client acquires the same advisory lock that upsertCommissionLine
      // takes internally. The production function must block until we release it.
      const ext = new Client({ connectionString: TEST_URL! });
      await ext.connect();
      await ext.query("BEGIN");
      await ext.query(
        `SELECT pg_advisory_xact_lock(('x' || md5($1))::bit(64)::bigint)`,
        [FP_ADV_LOCK]
      );

      const upsertPromise = withTimeout(
        upsertCommissionLine({ ...baseLine, invoiceDate: "2026-07-01", sourceFingerprint: FP_ADV_LOCK }),
        8_000,
        "upsertCommissionLine blocked by advisory lock"
      );

      // Give the production function time to enter its transaction and block.
      await new Promise<void>(r => setTimeout(r, 400));
      // Release the lock — upsertCommissionLine should now proceed.
      await ext.query("COMMIT");
      await ext.end();

      const result = await upsertPromise;
      assertEqual(result, "created", "UpsertAction after lock released");
    });

    // ── 5. lockCommissionPeriod — production function ─────────────────────
    console.log("");
    console.log("── 5. lockCommissionPeriod ─────────────────────────────────────");

    const LOCK_YEAR  = 2026;
    const LOCK_MONTH = 2;

    await assert("Empty period → 'Cannot lock: no commission lines found'", async () => {
      const r = await lockCommissionPeriod(ENTITY_LOCK, LOCK_YEAR, LOCK_MONTH, "ci-test");
      assertMatch(r!, /no commission lines found/i, "lockCommissionPeriod reason");
    });

    await assert("Period with 'needs_review' line (external rep) → cannot lock (not yet approved)", async () => {
      await pool.query(`
        INSERT INTO commission_run_lines
          (entity_id, invoice_id, invoice_qbo_id, invoice_date, line_status,
           payout_eligible, representative_id, source_fingerprint)
        VALUES ($1::uuid, $2::uuid, 'QBO-NR', '2026-02-01'::date, 'needs_review',
                true, $3::uuid, 'ci-fp-lock-needs-review')
      `, [ENTITY_LOCK, INVOICE_ID, JEROD_ID]);
      const r = await lockCommissionPeriod(ENTITY_LOCK, LOCK_YEAR, LOCK_MONTH, "ci-test");
      // Jerod is external_rep — production checks _blockers (external unapproved) before
      // _unresolved (any status), so needs_review for an external rep hits blocking first.
      assertMatch(r!, /not yet approved/i, "lockCommissionPeriod reason");
      await pool.query("DELETE FROM commission_run_lines WHERE source_fingerprint = 'ci-fp-lock-needs-review'");
    });

    await assert("Period with 'calculated' line (external rep) → cannot lock (not yet approved)", async () => {
      await pool.query(`
        INSERT INTO commission_run_lines
          (entity_id, invoice_id, invoice_qbo_id, invoice_date, line_status,
           payout_eligible, representative_id, source_fingerprint)
        VALUES ($1::uuid, $2::uuid, 'QBO-CALC', '2026-02-05'::date, 'calculated',
                true, $3::uuid, 'ci-fp-lock-calculated')
      `, [ENTITY_LOCK, INVOICE_ID, JEROD_ID]);
      const r = await lockCommissionPeriod(ENTITY_LOCK, LOCK_YEAR, LOCK_MONTH, "ci-test");
      // Jerod is external_rep — calculated status is NOT IN ('approved','locked','house_no_commission')
      // so blocking > 0 is triggered before problems > 0.
      assertMatch(r!, /not yet approved/i, "lockCommissionPeriod reason");
      await pool.query("DELETE FROM commission_run_lines WHERE source_fingerprint = 'ci-fp-lock-calculated'");
    });

    await assert("approved external + house_no_commission → lock succeeds (returns null)", async () => {
      await pool.query(`
        INSERT INTO commission_run_lines
          (entity_id, invoice_id, invoice_qbo_id, invoice_date, line_status,
           payout_eligible, representative_id, source_fingerprint)
        VALUES
          ($1::uuid, $2::uuid, 'QBO-EXT', '2026-02-10'::date, 'approved',
           true,  $3::uuid, 'ci-fp-lock-approved'),
          ($1::uuid, $2::uuid, 'QBO-HSE', '2026-02-15'::date, 'house_no_commission',
           false, $4::uuid, 'ci-fp-lock-house')
      `, [ENTITY_LOCK, INVOICE_ID, JEROD_ID, HOUSE_ID]);
      const r = await lockCommissionPeriod(ENTITY_LOCK, LOCK_YEAR, LOCK_MONTH, "ci-test");
      assertEqual(r, null, "lockCommissionPeriod return value");
    });

    await assert("After lock: all lines in period have status 'locked'", async () => {
      const r = await pool.query<{ line_status: string }>(`
        SELECT DISTINCT line_status FROM commission_run_lines
        WHERE entity_id = $1::uuid
          AND EXTRACT(YEAR  FROM invoice_date) = $2
          AND EXTRACT(MONTH FROM invoice_date) = $3
      `, [ENTITY_LOCK, LOCK_YEAR, LOCK_MONTH]);
      if (!r.rows.every(row => row.line_status === "locked"))
        throw new Error(`Expected all 'locked', got: ${r.rows.map(row => row.line_status).join(", ")}`);
    });

    await assert("After lock: commission_periods entry status = 'locked'", async () => {
      const r = await pool.query<{ status: string }>(
        "SELECT status FROM commission_periods WHERE entity_id = $1::uuid AND period_year = $2 AND period_month = $3",
        [ENTITY_LOCK, LOCK_YEAR, LOCK_MONTH]
      );
      assertEqual(r.rows.length, 1,        "commission_periods row exists");
      assertEqual(r.rows[0].status, "locked", "commission_periods status");
    });

    await assert("After lock: upsertCommissionLine into locked period → 'skipped'", async () => {
      const r = await upsertCommissionLine({
        entityId:          ENTITY_LOCK,
        invoiceId:         INVOICE_ID,
        invoiceQboId:      "QBO-POST-LOCK",
        invoiceDate:       "2026-02-20",
        lineStatus:        "attributed",
        payoutEligible:    false,
        sourceFingerprint: "ci-fp-post-lock",
      });
      assertEqual(r, "skipped", "UpsertAction");
    });

    // ── Done ─────────────────────────────────────────────────────────────
    console.log("");
    console.log(`✅  All ${passed} tests passed.`);
    console.log("    No local database, no Neon Core, no QBO connection was used.");

  } catch (err) {
    if (err instanceof Error && err.message !== "STOP") {
      console.error("\n❌  Unexpected error:", err.message);
    }
    console.error(`\n❌  Aborted after first failure. ${passed} passed.`);
    if (lastError) console.error(`    Error: ${lastError}`);
    process.exit(1);
  } finally {
    await pool.end().catch(() => {/* ignore */});
  }

  process.exit(0);
}

main().catch(err => {
  console.error("❌  Fatal:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
