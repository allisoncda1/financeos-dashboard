#!/usr/bin/env tsx
/**
 * Commission module — PostgreSQL integration test
 *
 * Calls production functions directly:
 *   createCommissionRule, upsertCommissionLine, lockCommissionPeriod
 *
 * Strategy: after environment guards, sets process.env.DATABASE_URL and
 * process.env.CORE_DATABASE_URL to TEST_DATABASE_URL, then dynamically imports
 * the production module. opsDb (backed by DATABASE_URL) therefore connects to the
 * throwaway test database. CORE_DATABASE_URL satisfies lib/db's startup check but
 * is never queried by commission functions.
 *
 * Requires:
 *   - TEST_DATABASE_URL pointing to a throwaway PostgreSQL instance
 *   - Database name must be "commission_test" or start with "commission_test_"
 *
 * How to run:
 *
 *   docker run --rm -d \
 *     --name pg_commission_test \
 *     -e POSTGRES_PASSWORD=test \
 *     -e POSTGRES_DB=commission_test \
 *     -p 127.0.0.1:5441:5432 \
 *     postgres:16
 *
 *   export TEST_DATABASE_URL="postgresql://postgres:test@127.0.0.1:5441/commission_test"
 *
 *   until docker exec pg_commission_test pg_isready -U postgres -d commission_test; do
 *     sleep 1
 *   done
 *
 *   cd artifacts/api-server
 *   TEST_DATABASE_URL="$TEST_DATABASE_URL" npm run test:commissions:pg
 *
 *   docker stop pg_commission_test
 *
 * Note: this script has never been executed — PostgreSQL is unavailable in this
 * development environment. Run it against a real throwaway instance before merge.
 */

// Only static imports of modules that do NOT read DATABASE_URL or CORE_DATABASE_URL.
// The production module is imported dynamically after env vars are set.
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import pg from "pg";

const { Pool, Client } = pg;

// ─── URL utilities ──────────────────────────────────────────────────────────

interface NormalizedUrl {
  host: string;   // 127.0.0.1 / hostname
  port: number;
  database: string;
}

function normalizeUrl(raw: string): NormalizedUrl | null {
  try {
    const u = new URL(raw);
    const host = (u.hostname === "localhost" ? "127.0.0.1" : u.hostname).toLowerCase();
    const port = parseInt(u.port || "5432", 10);
    const database = decodeURIComponent(u.pathname.replace(/^\//, ""));
    return { host, port, database };
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

// ─── Environment guards ─────────────────────────────────────────────────────

const TEST_URL = process.env.TEST_DATABASE_URL;

if (!TEST_URL) {
  console.error("❌  TEST_DATABASE_URL is not set.");
  console.error("    Set it to a throwaway PostgreSQL instance. Never use DATABASE_URL.");
  process.exit(1);
}

const testNorm = normalizeUrl(TEST_URL);
if (!testNorm) {
  console.error("❌  TEST_DATABASE_URL is not a valid URL:", maskUrl(TEST_URL));
  process.exit(1);
}

if (!testNorm.database.startsWith("commission_test")) {
  console.error(`❌  Database must be named "commission_test" or "commission_test_*".`);
  console.error(`    Got: "${testNorm.database}"`);
  console.error("    This guard prevents accidentally targeting a real database.");
  process.exit(1);
}

for (const [varName, rawUrl] of [
  ["DATABASE_URL",      process.env.DATABASE_URL],
  ["CORE_DATABASE_URL", process.env.CORE_DATABASE_URL],
] as [string, string | undefined][]) {
  if (!rawUrl) continue;
  const norm = normalizeUrl(rawUrl);
  if (norm && sameDestination(testNorm, norm)) {
    console.error(`❌  TEST_DATABASE_URL resolves to the same host/port/database as ${varName}.`);
    console.error(`    Refusing — would write to the real database.`);
    process.exit(1);
  }
}

// ─── Inject test database into the production module ───────────────────────
//
// lib/db/src/index.ts requires both DATABASE_URL and CORE_DATABASE_URL at import
// time. CORE_DATABASE_URL is set to TEST_URL as a dummy — commission functions
// only use opsDb (backed by DATABASE_URL) and never query via `db` (Core).
//
// These assignments must happen BEFORE the dynamic import below.

process.env.DATABASE_URL      = TEST_URL;
process.env.CORE_DATABASE_URL = TEST_URL;

// ─── Paths ──────────────────────────────────────────────────────────────────

const __dirname  = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS = path.resolve(__dirname, "../src/db/migrations");
const SQL_001    = path.join(MIGRATIONS, "commission_001_schema.sql");
const SQL_002    = path.join(MIGRATIONS, "commission_002_attribution_seed.sql");

for (const f of [SQL_001, SQL_002]) {
  if (!fs.existsSync(f)) {
    console.error(`❌  File not found: ${f}`);
    process.exit(1);
  }
}

// ─── Test harness ───────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
const errors: string[] = [];

async function assert(description: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
    console.log(`  ✓  ${description}`);
    passed++;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`  ✗  ${description}`);
    console.error(`       ${msg}`);
    failed++;
    errors.push(`${description}: ${msg}`);
    throw new Error("STOP"); // propagated to main() to exit on first failure
  }
}

function assertEqual<T>(actual: T, expected: T, label: string): void {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function assertMatch(actual: string, re: RegExp, label: string): void {
  if (!re.test(actual)) {
    throw new Error(`${label}: "${actual}" does not match ${re}`);
  }
}

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout after ${ms}ms: ${label}`)), ms)
    ),
  ]);
}

// ─── Constants ──────────────────────────────────────────────────────────────

// Fake entity UUIDs — commission_run_lines.entity_id has no FK constraint.
const ENTITY_RULES = "cccccccc-0000-4000-a000-000000000001"; // createCommissionRule tests
const ENTITY_LOCK  = "dddddddd-0000-4000-a000-000000000001"; // lockCommissionPeriod tests

// Fixed invoice UUID — commission_run_lines.invoice_id has no FK constraint.
const INVOICE_ID = "aaaaaaaa-0000-4000-a000-000000000001";

// Source fingerprints (one per distinct upsert scenario).
const FP_JAN       = "integration-fp-jan";
const FP_DATE_MOVE = "integration-fp-date-move";
const FP_NULL_OK   = "integration-fp-null-ok";
const FP_NULL_LOCK = "integration-fp-null-locked";
const FP_LOCKED    = "integration-fp-locked-period";
const FP_LOCK_BLOK = "integration-fp-concurrent-lock";

// ─── Main ───────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log("Commission module — PostgreSQL integration test");
  console.log(`  Database: ${maskUrl(TEST_URL!)}`);
  console.log(`  Using production functions: createCommissionRule, upsertCommissionLine, lockCommissionPeriod`);
  console.log("");

  // ── Direct pool for verification queries and setup ──────────────────────
  const pool = new Pool({ connectionString: TEST_URL!, max: 5 });

  // ── Dynamic import of production functions ──────────────────────────────
  // Resolves AFTER DATABASE_URL and CORE_DATABASE_URL are set above.
  const {
    createCommissionRule,
    upsertCommissionLine,
    lockCommissionPeriod,
  } = await import("../src/db/commissions.js");

  try {
    // ── Verify we are connected to the correct database ──────────────────

    const dbCheck = await pool.query<{ current_database: string }>("SELECT current_database()");
    const currentDb = dbCheck.rows[0].current_database;
    if (!currentDb.startsWith("commission_test")) {
      console.error(`❌  Connected database is "${currentDb}" — not a commission_test* database. Refusing.`);
      process.exit(1);
    }
    console.log(`  Connected to: ${currentDb}`);
    console.log("");

    // ── Full isolation: drop and recreate schema ─────────────────────────
    // Ensures no state leaks from a previous test run.
    await pool.query("DROP SCHEMA IF EXISTS public CASCADE");
    await pool.query("CREATE SCHEMA public");
    await pool.query("GRANT ALL ON SCHEMA public TO CURRENT_USER");

    // ── Section 1: Schema and seed ───────────────────────────────────────
    console.log("── 1. Schema and seed ─────────────────────────────────────────");

    await assert("commission_001_schema.sql applies without error", async () => {
      const sql = fs.readFileSync(SQL_001, "utf8");
      await pool.query(sql);
    });

    await assert("commission_002_attribution_seed.sql applies without error (run 1)", async () => {
      const sql = fs.readFileSync(SQL_002, "utf8");
      await pool.query(sql);
    });

    await assert("Seed produces exactly 31 attribution rules", async () => {
      const res = await pool.query<{ count: string }>(
        "SELECT COUNT(*)::text AS count FROM commission_attribution_rules"
      );
      assertEqual(res.rows[0].count, "31", "attribution rule count");
    });

    await assert("Seed is idempotent — second run still 31 rows (ON CONFLICT DO NOTHING)", async () => {
      const sql = fs.readFileSync(SQL_002, "utf8");
      await pool.query(sql);
      const res = await pool.query<{ count: string }>(
        "SELECT COUNT(*)::text AS count FROM commission_attribution_rules"
      );
      assertEqual(res.rows[0].count, "31", "attribution rule count after second seed run");
    });

    // ── Section 2: FK and constraint integrity ───────────────────────────
    console.log("");
    console.log("── 2. FK and constraint integrity ─────────────────────────────");

    await assert("No orphaned attribution rules (representative FK intact)", async () => {
      const res = await pool.query<{ count: string }>(`
        SELECT COUNT(*)::text AS count
        FROM commission_attribution_rules ar
        LEFT JOIN commission_representatives r ON r.id = ar.representative_id
        WHERE r.id IS NULL
      `);
      assertEqual(res.rows[0].count, "0", "orphaned attribution rules");
    });

    await assert("All four seeded slugs present: house, jerod, jason, big_mouth", async () => {
      const res = await pool.query<{ slug: string }>(
        "SELECT slug FROM commission_representatives WHERE slug IN ('house','jerod','jason','big_mouth') ORDER BY slug"
      );
      const slugs = res.rows.map(r => r.slug);
      for (const expected of ["big_mouth", "house", "jason", "jerod"]) {
        if (!slugs.includes(expected)) throw new Error(`Missing slug: ${expected}`);
      }
    });

    await assert("commission_periods uses period_year and period_month columns", async () => {
      const res = await pool.query<{ column_name: string }>(`
        SELECT column_name FROM information_schema.columns
        WHERE table_name = 'commission_periods'
          AND column_name IN ('period_year', 'period_month')
        ORDER BY column_name
      `);
      const cols = res.rows.map(r => r.column_name);
      if (!cols.includes("period_year"))  throw new Error("period_year column missing");
      if (!cols.includes("period_month")) throw new Error("period_month column missing");
    });

    await assert("commission_periods rejects period_month = 13 (check constraint 23514)", async () => {
      let threw = false;
      try {
        await pool.query(
          "INSERT INTO commission_periods (entity_id, period_year, period_month) VALUES ($1::uuid, 2026, 13)",
          [ENTITY_LOCK]
        );
      } catch (e: unknown) {
        threw = true;
        const code = (e as { code?: string }).code;
        if (code !== "23514") throw new Error(`Expected check_violation 23514, got ${code}`);
      }
      if (!threw) throw new Error("INSERT with period_month=13 should have thrown");
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
        if (code !== "23505") throw new Error(`Expected unique_violation 23505, got ${code}`);
      }
      if (!threw) throw new Error("Duplicate (entity, year, month) should have thrown");
      // Clean up to avoid interference with lock tests.
      await pool.query(
        "DELETE FROM commission_periods WHERE entity_id = $1::uuid AND period_year = 2026 AND period_month = 1",
        [ENTITY_LOCK]
      );
    });

    // ── Resolve seeded representative IDs ────────────────────────────────
    const repRes = await pool.query<{ slug: string; id: string }>(
      "SELECT slug, id::text FROM commission_representatives WHERE slug IN ('jerod','house') ORDER BY slug"
    );
    const repBySlug = Object.fromEntries(repRes.rows.map(r => [r.slug, r.id]));
    const JEROD_ID = repBySlug["jerod"];
    const HOUSE_ID = repBySlug["house"];
    if (!JEROD_ID) throw new Error("Setup error: jerod representative not found after seed");
    if (!HOUSE_ID) throw new Error("Setup error: house representative not found after seed");

    // ── Section 3: createCommissionRule (production function) ────────────
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
      reason:           "Integration test — single rule creation",
    };

    let firstRule: Awaited<ReturnType<typeof createCommissionRule>>;
    await assert("Single call creates rule, returns CommissionRule with version 1", async () => {
      firstRule = await createCommissionRule({ ...baseRule, customerNamePattern: "SingleScope" });
      assertEqual(firstRule.ruleVersion, 1,          "rule version");
      assertEqual(firstRule.status,      "active",   "rule status");
      assertEqual(firstRule.formulaType, "percentage_of_invoice", "formulaType");
    });

    await assert("Audit entry created for the new rule", async () => {
      const res = await pool.query<{ count: string }>(
        "SELECT COUNT(*)::text AS count FROM commission_rule_audit WHERE rule_id = $1::uuid",
        [firstRule.id]
      );
      assertEqual(res.rows[0].count, "1", "audit entries for SingleScope rule");
    });

    await assert("Two concurrent calls on same scope: advisory lock serializes → v1 superseded + v2 active", async () => {
      // Both calls use the same opsDb pool (backed by TEST_URL).
      // The advisory lock in createCommissionRule serializes them:
      //   First:  inserts version 1 (active), supersedes nothing.
      //   Second: sees version 1 active, supersedes it, inserts version 2 (active).
      // Result: 2 rows, v1 superseded, v2 active, 2 audit entries.
      const concurrentRule = {
        ...baseRule,
        customerNamePattern: "ConcurrentScope",
        reason: "Integration test — concurrent rule creation",
      };
      const [r1, r2] = await withTimeout(
        Promise.all([
          createCommissionRule(concurrentRule),
          createCommissionRule(concurrentRule),
        ]),
        10_000,
        "concurrent createCommissionRule"
      );

      // Both should have returned successfully (advisory lock prevented 23505 race).
      if (!r1 || !r2) throw new Error("One or both concurrent calls returned undefined");

      const rows = await pool.query<{ rule_version: number; status: string }>(`
        SELECT rule_version, status
        FROM commission_rules
        WHERE entity_id = $1::uuid
          AND representative_id = $2::uuid
          AND COALESCE(customer_name_pattern, '') = 'ConcurrentScope'
        ORDER BY rule_version
      `, [ENTITY_RULES, JEROD_ID]);

      assertEqual(rows.rows.length, 2, "total rows for ConcurrentScope");
      assertEqual(rows.rows[0].rule_version, 1,           "first row version");
      assertEqual(rows.rows[0].status,       "superseded", "first row status");
      assertEqual(rows.rows[1].rule_version, 2,           "second row version");
      assertEqual(rows.rows[1].status,       "active",    "second row status");

      const auditCount = await pool.query<{ count: string }>(`
        SELECT COUNT(*)::text AS count FROM commission_rule_audit
        WHERE rule_id IN (
          SELECT id FROM commission_rules
          WHERE entity_id = $1::uuid
            AND representative_id = $2::uuid
            AND COALESCE(customer_name_pattern, '') = 'ConcurrentScope'
        )
      `, [ENTITY_RULES, JEROD_ID]);
      assertEqual(auditCount.rows[0].count, "2", "audit entries for ConcurrentScope");
    });

    // ── Section 4: upsertCommissionLine (production function) ────────────
    console.log("");
    console.log("── 4. upsertCommissionLine ─────────────────────────────────────");

    const baseLine = {
      entityId:         ENTITY_RULES,
      invoiceId:        INVOICE_ID,
      invoiceQboId:     "QBO-INT",
      lineStatus:       "attributed",
      payoutEligible:   false,
    };

    await assert("First ingest (January date) → 'created'", async () => {
      const result = await upsertCommissionLine({
        ...baseLine,
        invoiceDate:       "2026-01-15",
        sourceFingerprint: FP_JAN,
      });
      assertEqual(result, "created", "UpsertAction");
    });

    await assert("Same fingerprint, second ingest (January date again) → 'updated'", async () => {
      const result = await upsertCommissionLine({
        ...baseLine,
        invoiceDate:       "2026-01-15",
        customerName:      "Acme Corp",   // changed field
        sourceFingerprint: FP_JAN,
      });
      assertEqual(result, "updated", "UpsertAction");
    });

    await assert("Date move: same fingerprint, February date → 'updated', row reflects Feb date", async () => {
      await upsertCommissionLine({
        ...baseLine,
        invoiceDate:       "2026-01-20",
        sourceFingerprint: FP_DATE_MOVE,
      });
      const result = await upsertCommissionLine({
        ...baseLine,
        invoiceDate:       "2026-02-05",
        sourceFingerprint: FP_DATE_MOVE,
      });
      assertEqual(result, "updated", "UpsertAction after date move");

      const row = await pool.query<{ invoice_date: string }>(
        "SELECT invoice_date::text FROM commission_run_lines WHERE source_fingerprint = $1",
        [FP_DATE_MOVE]
      );
      assertEqual(row.rows.length, 1, "one row for FP_DATE_MOVE");
      assertMatch(row.rows[0].invoice_date, /^2026-02/, "invoice_date after move");
    });

    await assert("date→null on UNLOCKED period → 'updated', invoice_date becomes null", async () => {
      // Insert with March 2026 date (period not locked).
      await upsertCommissionLine({
        ...baseLine,
        invoiceDate:       "2026-03-10",
        sourceFingerprint: FP_NULL_OK,
      });
      // Null-date re-ingest: March 2026 is not locked → allowed.
      const result = await upsertCommissionLine({
        ...baseLine,
        invoiceDate:       null,
        sourceFingerprint: FP_NULL_OK,
      });
      assertEqual(result, "updated", "UpsertAction date→null on unlocked period");

      const row = await pool.query<{ invoice_date: string | null }>(
        "SELECT invoice_date FROM commission_run_lines WHERE source_fingerprint = $1",
        [FP_NULL_OK]
      );
      assertEqual(row.rows[0].invoice_date, null, "invoice_date is null after null-date upsert");
    });

    await assert("date→null on LOCKED period → 'skipped', date unchanged", async () => {
      // Insert with April 2026 date.
      await upsertCommissionLine({
        ...baseLine,
        invoiceDate:       "2026-04-12",
        sourceFingerprint: FP_NULL_LOCK,
      });
      // Lock April 2026.
      await pool.query(
        `INSERT INTO commission_periods (entity_id, period_year, period_month, status, locked_by, locked_at)
         VALUES ($1::uuid, 2026, 4, 'locked', 'integration-test', now())
         ON CONFLICT (entity_id, period_year, period_month)
         DO UPDATE SET status = 'locked', locked_at = now()`,
        [ENTITY_RULES]
      );
      // Re-ingest with null date: old period (April 2026) is locked → must return 'skipped'.
      const result = await upsertCommissionLine({
        ...baseLine,
        invoiceDate:       null,
        sourceFingerprint: FP_NULL_LOCK,
      });
      assertEqual(result, "skipped", "UpsertAction date→null on locked period");

      const row = await pool.query<{ invoice_date: string }>(
        "SELECT invoice_date::text FROM commission_run_lines WHERE source_fingerprint = $1",
        [FP_NULL_LOCK]
      );
      assertMatch(row.rows[0].invoice_date, /^2026-04/, "date unchanged after skipped null-date upsert");
    });

    await assert("New line into LOCKED period → 'skipped', no row created", async () => {
      // Lock May 2026 for ENTITY_RULES.
      await pool.query(
        `INSERT INTO commission_periods (entity_id, period_year, period_month, status, locked_by, locked_at)
         VALUES ($1::uuid, 2026, 5, 'locked', 'integration-test', now())
         ON CONFLICT (entity_id, period_year, period_month)
         DO UPDATE SET status = 'locked', locked_at = now()`,
        [ENTITY_RULES]
      );
      const result = await upsertCommissionLine({
        ...baseLine,
        invoiceDate:       "2026-05-20",
        sourceFingerprint: FP_LOCKED,
      });
      assertEqual(result, "skipped", "UpsertAction into locked period");

      const row = await pool.query<{ count: string }>(
        "SELECT COUNT(*)::text AS count FROM commission_run_lines WHERE source_fingerprint = $1",
        [FP_LOCKED]
      );
      assertEqual(row.rows[0].count, "0", "no row created for skipped ingest into locked period");
    });

    // ── Advisory lock: concurrent upsert blocked until lock released ─────
    await assert("Concurrent upsert: external advisory lock blocks production function until released", async () => {
      // An external client holds the source_fingerprint advisory lock.
      // upsertCommissionLine must block on the same lock until the external client commits.
      const externalClient = new Client({ connectionString: TEST_URL! });
      await externalClient.connect();
      await externalClient.query("BEGIN");
      // Acquire the same advisory lock that upsertCommissionLine will try to take.
      await externalClient.query(
        `SELECT pg_advisory_xact_lock(('x' || md5($1))::bit(64)::bigint)`,
        [FP_LOCK_BLOK]
      );

      // Start upsertCommissionLine — it will block inside its transaction on pg_advisory_xact_lock.
      const upsertPromise = withTimeout(
        upsertCommissionLine({
          ...baseLine,
          invoiceDate:       "2026-07-01",
          sourceFingerprint: FP_LOCK_BLOK,
        }),
        8_000,
        "upsertCommissionLine blocked by external advisory lock"
      );

      // Give upsertCommissionLine time to start and block (it should be waiting for the lock).
      await new Promise<void>(r => setTimeout(r, 400));

      // Release the external lock by committing.
      await externalClient.query("COMMIT");
      await externalClient.end();

      // Now upsertCommissionLine should unblock and complete.
      const result = await upsertPromise;
      assertEqual(result, "created", "UpsertAction after advisory lock released");
    });

    // ── Section 5: lockCommissionPeriod (production function) ────────────
    console.log("");
    console.log("── 5. lockCommissionPeriod ─────────────────────────────────────");

    // Insert lines for the lock tests into ENTITY_LOCK.
    // Using period 2026-02 (February) for these tests.
    const lockPeriodYear  = 2026;
    const lockPeriodMonth = 2;

    await assert("Empty period → cannot lock (no commission lines found)", async () => {
      const reason = await lockCommissionPeriod(ENTITY_LOCK, lockPeriodYear, lockPeriodMonth, "integration-test");
      assertMatch(reason!, /no commission lines found/i, "lockCommissionPeriod reason for empty period");
    });

    await assert("Period with 'needs_review' line → cannot lock (unresolved status)", async () => {
      await pool.query(`
        INSERT INTO commission_run_lines
          (entity_id, invoice_id, invoice_qbo_id, invoice_date, line_status,
           payout_eligible, representative_id, source_fingerprint)
        VALUES
          ($1::uuid, $2::uuid, 'QBO-LOCK-NR', '2026-02-01'::date, 'needs_review',
           true, $3::uuid, 'fp-lock-test-needs-review')
      `, [ENTITY_LOCK, INVOICE_ID, JEROD_ID]);

      const reason = await lockCommissionPeriod(ENTITY_LOCK, lockPeriodYear, lockPeriodMonth, "integration-test");
      assertMatch(reason!, /unresolved status/i, "lockCommissionPeriod reason for needs_review");

      await pool.query(
        "DELETE FROM commission_run_lines WHERE source_fingerprint = 'fp-lock-test-needs-review'"
      );
    });

    await assert("Period with 'calculated' line → cannot lock (unresolved status)", async () => {
      await pool.query(`
        INSERT INTO commission_run_lines
          (entity_id, invoice_id, invoice_qbo_id, invoice_date, line_status,
           payout_eligible, representative_id, source_fingerprint)
        VALUES
          ($1::uuid, $2::uuid, 'QBO-LOCK-CALC', '2026-02-05'::date, 'calculated',
           true, $3::uuid, 'fp-lock-test-calculated')
      `, [ENTITY_LOCK, INVOICE_ID, JEROD_ID]);

      const reason = await lockCommissionPeriod(ENTITY_LOCK, lockPeriodYear, lockPeriodMonth, "integration-test");
      assertMatch(reason!, /unresolved status/i, "lockCommissionPeriod reason for calculated");

      await pool.query(
        "DELETE FROM commission_run_lines WHERE source_fingerprint = 'fp-lock-test-calculated'"
      );
    });

    await assert("External 'approved' + house 'house_no_commission' → lock succeeds (returns null)", async () => {
      // Insert one external rep line in 'approved' status.
      await pool.query(`
        INSERT INTO commission_run_lines
          (entity_id, invoice_id, invoice_qbo_id, invoice_date, line_status,
           payout_eligible, representative_id, source_fingerprint)
        VALUES
          ($1::uuid, $2::uuid, 'QBO-LOCK-EXT', '2026-02-10'::date, 'approved',
           true, $3::uuid, 'fp-lock-test-approved')
      `, [ENTITY_LOCK, INVOICE_ID, JEROD_ID]);

      // Insert one house line in 'house_no_commission' status.
      await pool.query(`
        INSERT INTO commission_run_lines
          (entity_id, invoice_id, invoice_qbo_id, invoice_date, line_status,
           payout_eligible, representative_id, source_fingerprint)
        VALUES
          ($1::uuid, $2::uuid, 'QBO-LOCK-HSE', '2026-02-15'::date, 'house_no_commission',
           false, $3::uuid, 'fp-lock-test-house')
      `, [ENTITY_LOCK, INVOICE_ID, HOUSE_ID]);

      const reason = await lockCommissionPeriod(ENTITY_LOCK, lockPeriodYear, lockPeriodMonth, "integration-test");
      assertEqual(reason, null, "lockCommissionPeriod return value (null = success)");
    });

    await assert("After lock: run lines become 'locked' status", async () => {
      const res = await pool.query<{ line_status: string }>(`
        SELECT DISTINCT line_status
        FROM commission_run_lines
        WHERE entity_id = $1::uuid
          AND EXTRACT(YEAR  FROM invoice_date) = $2
          AND EXTRACT(MONTH FROM invoice_date) = $3
      `, [ENTITY_LOCK, lockPeriodYear, lockPeriodMonth]);
      const statuses = res.rows.map(r => r.line_status);
      if (!statuses.every(s => s === "locked")) {
        throw new Error(`Expected all lines to be 'locked', got: ${statuses.join(", ")}`);
      }
    });

    await assert("After lock: commission_periods entry has status 'locked'", async () => {
      const res = await pool.query<{ status: string }>(
        "SELECT status FROM commission_periods WHERE entity_id = $1::uuid AND period_year = $2 AND period_month = $3",
        [ENTITY_LOCK, lockPeriodYear, lockPeriodMonth]
      );
      assertEqual(res.rows.length, 1, "commission_periods row exists");
      assertEqual(res.rows[0].status, "locked", "commission_periods status");
    });

    await assert("After lock: upsertCommissionLine into locked period → 'skipped'", async () => {
      const result = await upsertCommissionLine({
        entityId:         ENTITY_LOCK,
        invoiceId:        INVOICE_ID,
        invoiceQboId:     "QBO-POST-LOCK",
        invoiceDate:      "2026-02-20",
        lineStatus:       "attributed",
        payoutEligible:   false,
        sourceFingerprint: "fp-lock-test-post-lock",
      });
      assertEqual(result, "skipped", "UpsertAction into locked period after lockCommissionPeriod");
    });

    // ── Done ─────────────────────────────────────────────────────────────
    console.log("");
    console.log(`✅  All ${passed} tests passed.`);
    console.log("");
    console.log("NOTE: This script was written but not executed — PostgreSQL is unavailable");
    console.log("      in this development environment. Run it against a real throwaway instance");
    console.log("      before promoting the PR to ready-for-review.");

  } catch (err) {
    if (err instanceof Error && err.message !== "STOP") {
      console.error("\n❌  Unexpected error:", err.message);
    }
    console.error(`\n❌  Test suite aborted. ${passed} passed, ${failed} failed.`);
    if (errors.length) console.error("     Last error:", errors[errors.length - 1]);
    process.exit(1);
  } finally {
    await pool.end().catch(() => {/* ignore */});
    // The opsDb pool (created by lib/db/src/index.ts on dynamic import) is closed
    // by process.exit below. pg connections are file descriptors released by the OS.
  }

  process.exit(0);
}

main().catch((err) => {
  console.error("\n❌  Fatal:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
