#!/usr/bin/env tsx
/**
 * Commission Documents — CI-only PostgreSQL integration runner
 *
 * PURPOSE
 * -------
 * Validates, against a REAL PostgreSQL instance (not mocks), the invariants
 * that a unit test cannot honestly prove:
 *   - migration commission_004_documents_expenses.sql applies cleanly on top
 *     of 001/002/003, twice (idempotent)
 *   - the lease/claim model (claimDocumentForProcessing / completeProcessing
 *     / findClaimableDocuments) actually serializes under Postgres row
 *     locking, including lease-expiry recovery
 *   - TWO GENUINELY CONCURRENT createAllocations() calls against the same
 *     commission_document_lines row are serialized by the real SELECT ...
 *     FOR UPDATE lock, and the over-allocation guard is enforced against the
 *     post-lock re-read — not against a snapshot a mock could get wrong
 *   - a failure partway through a multi-allocation batch rolls back the
 *     entire transaction (no partial allocation left behind)
 *   - entity isolation (a document in entity A is invisible via entity B)
 *   - recalculateRunLineAfterAllocation both with a configured rule (real
 *     commission_amount computed) and with NO rule at all (Jason's
 *     situation — never invents a rate: commission_amount stays null,
 *     line_status = 'needs_configuration', configured:false)
 *
 * Follows the exact same CI-only gating pattern as test-commissions-pg.ts —
 * see that file for the full rationale. This script reuses the same
 * postgres:16 service container and commission_test_ci* database.
 *
 * NOTE — unlike test-commissions-pg.ts, this script ALSO sets
 * CORE_DATABASE_URL/DATABASE_URL (see the comment right before the dynamic
 * import below). That's a module-load-time workaround for an unrelated,
 * pre-existing top-level `@workspace/db` import inside
 * services/commissionEngine.ts, not a real dependency on Neon Core — this
 * script never queries through it.
 *
 * EXIT CODE: 0 all passed, 1 first failure / missing env / unexpected error.
 */

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import pg from "pg";

const { Pool } = pg;

// ─── CI context guard ──────────────────────────────────────────────────────

const IS_CI = process.env.GITHUB_ACTIONS === "true" || process.env.CI === "true";
if (!IS_CI) {
  console.error("❌  This script runs only in CI (GITHUB_ACTIONS=true or CI=true).");
  console.error("    No local database setup is supported or required.");
  process.exit(1);
}

// ─── URL utilities (identical to test-commissions-pg.ts) ──────────────────

interface NormalizedUrl { host: string; port: number; database: string; }

function normalizeUrl(raw: string): NormalizedUrl | null {
  try {
    const u = new URL(raw);
    const host = (u.hostname === "localhost" ? "127.0.0.1" : u.hostname).toLowerCase();
    return { host, port: parseInt(u.port || "5432", 10), database: decodeURIComponent(u.pathname.replace(/^\//, "")) };
  } catch { return null; }
}

function sameDestination(a: NormalizedUrl, b: NormalizedUrl): boolean {
  return a.host === b.host && a.port === b.port && a.database === b.database;
}

function maskUrl(raw: string): string {
  try { const u = new URL(raw); u.password = "***"; u.username = u.username ? "***" : ""; return u.toString(); }
  catch { return "<invalid url>"; }
}

// ─── Environment guards ────────────────────────────────────────────────────

const TEST_URL = process.env.TEST_DATABASE_URL;
if (!TEST_URL) {
  console.error("❌  TEST_DATABASE_URL is not set.");
  process.exit(1);
}

const testNorm = normalizeUrl(TEST_URL);
if (!testNorm) {
  console.error("❌  TEST_DATABASE_URL is not a valid URL:", maskUrl(TEST_URL));
  process.exit(1);
}

if (!testNorm.database.startsWith("commission_test_ci")) {
  console.error(`❌  Database must be named "commission_test_ci" or "commission_test_ci_*". Got: "${testNorm.database}"`);
  process.exit(1);
}

for (const [name, raw] of [
  ["COMMISSION_DATABASE_URL", process.env.COMMISSION_DATABASE_URL],
  ["DATABASE_URL", process.env.DATABASE_URL],
  ["CORE_DATABASE_URL", process.env.CORE_DATABASE_URL],
] as [string, string | undefined][]) {
  if (!raw) continue;
  const norm = normalizeUrl(raw);
  if (norm && sameDestination(testNorm, norm)) {
    console.error(`❌  TEST_DATABASE_URL resolves to the same host/port/database as ${name}. Refusing.`);
    process.exit(1);
  }
}

process.env.COMMISSION_DATABASE_URL = TEST_URL;

// CORE_DATABASE_URL / DATABASE_URL — set to the SAME ephemeral CI container
// as TEST_DATABASE_URL, and never queried through in this script.
//
// Why this is needed: db/commissionDocuments.ts imports applyFormula from
// services/commissionEngine.ts (a pure function — no I/O) to recompute a
// commission after an allocation. That file also has an unrelated,
// pre-existing top-level `import { invoices } from "@workspace/db"` for a
// different, Core-reading function this script never calls. @workspace/db's
// module (lib/db/src/index.ts) throws at IMPORT TIME — before any of our
// code runs — if CORE_DATABASE_URL/DATABASE_URL aren't set, regardless of
// whether the importing code path actually touches Core.
//
// Setting them to TEST_DATABASE_URL's own ephemeral container (rather than
// leaving them unset, or pointing anywhere else) satisfies that import-time
// guard while guaranteeing this can never reach a real database: pg.Pool
// does not open a connection at construction time, only when a query is
// issued through it — and nothing in this script ever imports or calls
// anything from @workspace/db's `db`/`opsDb` exports. This is strictly a
// module-load workaround, not a real dependency on Core or the ops DB.
process.env.CORE_DATABASE_URL = TEST_URL;
process.env.DATABASE_URL = TEST_URL;

// ─── Paths ─────────────────────────────────────────────────────────────────

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS = path.resolve(__dirname, "../src/db/migrations");
const SQL_FILES = ["commission_001_schema.sql", "commission_002_attribution_seed.sql", "commission_003_review_inputs.sql", "commission_004_documents_expenses.sql"]
  .map((f) => path.join(MIGRATIONS, f));

for (const f of SQL_FILES) {
  if (!fs.existsSync(f)) { console.error(`❌  Migration not found: ${f}`); process.exit(1); }
}

// ─── Test harness (identical shape to test-commissions-pg.ts) ─────────────

let passed = 0;
let lastError = "";

async function assert(description: string, fn: () => Promise<void>): Promise<void> {
  try { await fn(); console.log(`  ✓  ${description}`); passed++; }
  catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`  ✗  ${description}`);
    console.error(`       ${msg}`);
    lastError = msg;
    throw new Error("STOP");
  }
}

function assertEqual<T>(actual: T, expected: T, label: string): void {
  if (actual !== expected) throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

async function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([p, new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`Timeout after ${ms}ms: ${label}`)), ms))]);
}

/**
 * Unwraps drizzle-orm's DrizzleQueryError (whose own `.message`/`.code` are
 * not the underlying driver error) to reach the real pg DatabaseError's
 * SQLSTATE `code` — same unwrapping db/commissionDocuments.ts's
 * findPgDatabaseError() does for its own duplicate-detection. A raw
 * assertion error thrown by this script (e.g. "Expected X, got Y") is
 * itself a plain Error with no `code`, so this correctly returns null for
 * those rather than reaching into an unrelated `.cause`.
 */
function unwrapPgErrorCode(err: unknown): string | undefined {
  let current: unknown = err;
  for (let i = 0; i < 5 && current instanceof Error; i++) {
    if ("code" in current) {
      const code = (current as { code?: unknown }).code;
      if (typeof code === "string") return code;
    }
    current = (current as { cause?: unknown }).cause;
  }
  return undefined;
}

// ─── Fixed test constants ──────────────────────────────────────────────────

const ENTITY_A = "eeeeeeee-0000-4000-a000-000000000001";
const ENTITY_B = "eeeeeeee-0000-4000-a000-000000000002";

// ─── Main ──────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log("Commission Documents PostgreSQL integration — CI runner");
  console.log(`  Database : ${maskUrl(TEST_URL!)}`);
  console.log(`  CI       : GITHUB_ACTIONS=${process.env.GITHUB_ACTIONS ?? "?"}`);
  console.log("");

  const pool = new Pool({ connectionString: TEST_URL!, max: 10 });

  const {
    createCommissionDocument,
    claimDocumentForProcessing,
    completeProcessing,
    findClaimableDocuments,
    getCommissionDocumentById,
    createAllocations,
    getAllocationsForDocumentLine,
    recalculateRunLineAfterAllocation,
  } = await import("../src/db/commissionDocuments.js");

  try {
    const dbCheck = await pool.query<{ current_database: string }>("SELECT current_database()");
    const currentDb = dbCheck.rows[0].current_database;
    if (!currentDb.startsWith("commission_test_ci")) {
      console.error(`❌  Connected to "${currentDb}" — not a commission_test_ci* database. Aborting.`);
      process.exit(1);
    }
    console.log(`  Verified: current_database() = "${currentDb}"`);
    console.log("");

    await pool.query("DROP SCHEMA IF EXISTS public CASCADE");
    await pool.query("CREATE SCHEMA public");
    await pool.query("GRANT ALL ON SCHEMA public TO CURRENT_USER");

    // ── 1. Migration application ──────────────────────────────────────────
    console.log("── 1. Migration application ────────────────────────────────────");

    for (const f of SQL_FILES) {
      const name = path.basename(f);
      await assert(`${name} applies without error`, async () => {
        await pool.query(fs.readFileSync(f, "utf8"));
      });
    }

    await assert("commission_004 is idempotent — reapplying causes no error and no duplicate tables", async () => {
      await pool.query(fs.readFileSync(SQL_FILES[SQL_FILES.length - 1], "utf8"));
      const r = await pool.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM information_schema.tables WHERE table_name = 'commission_documents'`,
      );
      assertEqual(r.rows[0].count, "1", "commission_documents table count");
    });

    await assert("lead_source column was NOT added anywhere (scoped out of this migration)", async () => {
      const r = await pool.query<{ count: string }>(`
        SELECT COUNT(*)::text AS count FROM information_schema.columns
        WHERE table_name IN ('commission_attribution_rules', 'commission_rules') AND column_name = 'lead_source'
      `);
      assertEqual(r.rows[0].count, "0", "lead_source column count");
    });

    // ── 2. Schema / constraint integrity ──────────────────────────────────
    console.log("");
    console.log("── 2. Schema / constraint integrity ────────────────────────────");

    await assert("attempts CHECK rejects a negative value (23514)", async () => {
      let threw = false;
      try {
        await pool.query(`
          INSERT INTO commission_documents (entity_id, file_name, file_size, sha256, storage_key, storage_provider, created_by, attempts)
          VALUES ($1::uuid, 'x.pdf', 100, 'sha-neg', 'key-neg', 'replit-object-storage', 'ci-test', -1)
        `, [ENTITY_A]);
      } catch (e: unknown) {
        threw = true;
        if ((e as { code?: string }).code !== "23514") throw new Error(`Expected 23514, got ${(e as { code?: string }).code}`);
      }
      if (!threw) throw new Error("negative attempts should have been rejected");
    });

    await assert("a document line referencing a non-existent document is rejected by the FK", async () => {
      let threw = false;
      try {
        await pool.query(`
          INSERT INTO commission_document_lines (document_id, line_index) VALUES ($1::uuid, 0)
        `, ["ffffffff-0000-4000-a000-000000000099"]);
      } catch (e: unknown) {
        threw = true;
        if ((e as { code?: string }).code !== "23503") throw new Error(`Expected 23503 (FK violation), got ${(e as { code?: string }).code}`);
      }
      if (!threw) throw new Error("orphaned document line should have been rejected");
    });

    await assert("an allocation with a blank reason is rejected by the CHECK (23514), proving it's enforced at the DB layer too", async () => {
      // Set up a minimal document/line/run-line to attempt the insert against.
      const docRows = await pool.query<{ id: string }>(`
        INSERT INTO commission_documents (entity_id, file_name, file_size, sha256, storage_key, storage_provider, created_by)
        VALUES ($1::uuid, 'blank-reason.pdf', 100, 'sha-blank', 'key-blank', 'replit-object-storage', 'ci-test')
        RETURNING id::text
      `, [ENTITY_A]);
      const lineRows = await pool.query<{ id: string }>(`
        INSERT INTO commission_document_lines (document_id, line_index, extracted_amount)
        VALUES ($1::uuid, 0, 50.00) RETURNING id::text
      `, [docRows.rows[0].id]);
      const runLineRows = await pool.query<{ id: string }>(`
        INSERT INTO commission_run_lines (entity_id, invoice_id, invoice_qbo_id, invoice_amount, line_status, source_fingerprint)
        VALUES ($1::uuid, gen_random_uuid(), 'QBO-BLANK', 500.00, 'attributed', 'ci-fp-blank-reason') RETURNING id::text
      `, [ENTITY_A]);
      let threw = false;
      try {
        await pool.query(`
          INSERT INTO commission_expense_allocations (document_line_id, commission_run_line_id, allocation_method, allocated_amount, reason, created_by)
          VALUES ($1::uuid, $2::uuid, 'fixed_amount', 10.00, '   ', 'ci-test')
        `, [lineRows.rows[0].id, runLineRows.rows[0].id]);
      } catch (e: unknown) {
        threw = true;
        if ((e as { code?: string }).code !== "23514") throw new Error(`Expected 23514, got ${(e as { code?: string }).code}`);
      }
      if (!threw) throw new Error("blank reason should have been rejected");
    });

    // ── 3. Upload metadata (createCommissionDocument) ─────────────────────
    console.log("");
    console.log("── 3. Upload metadata — createCommissionDocument ───────────────");

    let doc1: Awaited<ReturnType<typeof createCommissionDocument>>;
    await assert("first upload creates a new document, status='uploaded'", async () => {
      doc1 = await createCommissionDocument({
        entityId: ENTITY_A, fileName: "mca-invoice.pdf", contentType: "application/pdf", fileSize: 1024,
        sha256: "sha-mca-001", storageKey: "commission-documents/mca-001.pdf", storageProvider: "replit-object-storage",
        createdBy: "ci-test", idempotencyKey: "idem-mca-001",
      });
      assertEqual(doc1.created, true, "created");
      assertEqual(doc1.document.status, "uploaded", "status");
      assertEqual(doc1.document.attempts, 0, "attempts");
    });

    await assert("re-upload with the same idempotency key returns the SAME row, created:false", async () => {
      const doc2 = await createCommissionDocument({
        entityId: ENTITY_A, fileName: "mca-invoice.pdf", contentType: "application/pdf", fileSize: 1024,
        sha256: "sha-mca-001", storageKey: "commission-documents/mca-001-retry.pdf", storageProvider: "replit-object-storage",
        createdBy: "ci-test", idempotencyKey: "idem-mca-001",
      });
      assertEqual(doc2.created, false, "created");
      assertEqual(doc2.document.id, doc1.document.id, "same document id");
    });

    await assert("uploading identical bytes (same sha256) again for the SAME entity under a NEW idempotency key throws DUPLICATE_DOCUMENT", async () => {
      let threw = false;
      try {
        await createCommissionDocument({
          entityId: ENTITY_A, fileName: "mca-invoice-copy.pdf", contentType: "application/pdf", fileSize: 1024,
          sha256: "sha-mca-001", storageKey: "commission-documents/mca-001-copy.pdf", storageProvider: "replit-object-storage",
          createdBy: "ci-test", idempotencyKey: "idem-mca-001-different",
        });
      } catch (e: unknown) {
        threw = true;
        if ((e as { code?: string }).code !== "DUPLICATE_DOCUMENT") throw new Error(`Expected DUPLICATE_DOCUMENT, got ${(e as { code?: string }).code}`);
      }
      if (!threw) throw new Error("duplicate sha256 for the same entity should have thrown");
    });

    await assert("identical bytes uploaded for a DIFFERENT entity is NOT a duplicate (entity isolation on dedup)", async () => {
      const doc = await createCommissionDocument({
        entityId: ENTITY_B, fileName: "mca-invoice.pdf", contentType: "application/pdf", fileSize: 1024,
        sha256: "sha-mca-001", storageKey: "commission-documents/mca-001-entity-b.pdf", storageProvider: "replit-object-storage",
        createdBy: "ci-test", idempotencyKey: "idem-mca-001-entity-b",
      });
      assertEqual(doc.created, true, "created for entity B");
    });

    // ── 4. Entity isolation ────────────────────────────────────────────────
    console.log("");
    console.log("── 4. Entity isolation ──────────────────────────────────────────");

    await assert("a document belonging to entity A is invisible via entity B's id", async () => {
      const viaA = await getCommissionDocumentById(ENTITY_A, doc1!.document.id);
      const viaB = await getCommissionDocumentById(ENTITY_B, doc1!.document.id);
      if (!viaA) throw new Error("Expected document to be visible via its own entity");
      if (viaB) throw new Error("Document leaked across entity boundary");
    });

    // ── 5. Lease / claim model ─────────────────────────────────────────────
    console.log("");
    console.log("── 5. Lease / claim model ──────────────────────────────────────");

    await assert("claimDocumentForProcessing claims an 'uploaded' document, sets a lease, increments attempts", async () => {
      const claim = await claimDocumentForProcessing(doc1!.document.id, 5 * 60 * 1000);
      if (!claim.claimed) throw new Error("Expected claim to succeed");
      assertEqual(claim.document.status, "processing", "status");
      assertEqual(claim.document.attempts, 1, "attempts");
      if (!claim.document.leaseExpiresAt) throw new Error("Expected lease_expires_at to be set");
    });

    await assert("a second claim attempt while the lease is still active fails with not_claimable", async () => {
      const claim = await claimDocumentForProcessing(doc1!.document.id, 5 * 60 * 1000);
      if (claim.claimed) throw new Error("Second claim should NOT have succeeded while the first lease is active");
      assertEqual(claim.reason, "not_claimable", "reason");
    });

    await assert("completeProcessing(needs_review) clears the lease and stamps the extracted fields", async () => {
      await completeProcessing(doc1!.document.id, {
        status: "needs_review", vendorName: "MCA", documentNumber: "MCA2026_016",
        documentDate: "2026-07-31", documentTotal: "1446.53", periodYear: 2026, periodMonth: 7,
      });
      const after = await getCommissionDocumentById(ENTITY_A, doc1!.document.id);
      assertEqual(after!.status, "needs_review", "status");
      assertEqual(after!.leaseExpiresAt, null, "lease cleared");
      assertEqual(after!.processingStartedAt, null, "processing_started_at cleared");
      assertEqual(after!.vendorName, "MCA", "vendorName");
    });

    await assert("simulated abandoned document: expired lease becomes claimable again (crash-recovery)", async () => {
      // Manually force a document into 'processing' with an already-expired
      // lease — simulating a worker that crashed mid-extraction and never
      // called completeProcessing.
      const abandoned = await createCommissionDocument({
        entityId: ENTITY_A, fileName: "abandoned.pdf", contentType: "application/pdf", fileSize: 512,
        sha256: "sha-abandoned", storageKey: "commission-documents/abandoned.pdf", storageProvider: "replit-object-storage",
        createdBy: "ci-test", idempotencyKey: "idem-abandoned",
      });
      await pool.query(`
        UPDATE commission_documents SET status = 'processing', processing_started_at = now() - interval '10 minutes',
          lease_expires_at = now() - interval '5 minutes', attempts = 1
        WHERE id = $1::uuid
      `, [abandoned.document.id]);

      const claimableBefore = await findClaimableDocuments(ENTITY_A);
      if (!claimableBefore.some((d) => d.id === abandoned.document.id)) {
        throw new Error("Expired-lease document should be discoverable via findClaimableDocuments");
      }

      const reclaim = await claimDocumentForProcessing(abandoned.document.id, 5 * 60 * 1000);
      if (!reclaim.claimed) throw new Error("Expired-lease document should be reclaimable");
      assertEqual(reclaim.document.attempts, 2, "attempts incremented on reclaim");
    });

    await assert("completeProcessing(failed) clears the lease, stamps last_error and next_retry_at", async () => {
      const doc = await createCommissionDocument({
        entityId: ENTITY_A, fileName: "will-fail.pdf", contentType: "application/pdf", fileSize: 256,
        sha256: "sha-will-fail", storageKey: "commission-documents/will-fail.pdf", storageProvider: "replit-object-storage",
        createdBy: "ci-test", idempotencyKey: "idem-will-fail",
      });
      await claimDocumentForProcessing(doc.document.id, 5 * 60 * 1000);
      const nextRetryAt = new Date(Date.now() + 30_000).toISOString();
      await completeProcessing(doc.document.id, { status: "failed", lastError: "Simulated extraction failure", nextRetryAt });
      const after = await getCommissionDocumentById(ENTITY_A, doc.document.id);
      assertEqual(after!.status, "failed", "status");
      assertEqual(after!.leaseExpiresAt, null, "lease cleared");
      assertEqual(after!.lastError, "Simulated extraction failure", "lastError");
      if (!after!.nextRetryAt) throw new Error("Expected next_retry_at to be stamped");
    });

    // ── 6. TWO GENUINE CONCURRENT createAllocations calls ─────────────────
    console.log("");
    console.log("── 6. Concurrent allocations — real transactions, not mocks ────");

    const CONCURRENCY_INVOICE_A = "faaaaaaa-0000-4000-a000-000000000001";
    const CONCURRENCY_INVOICE_B = "faaaaaaa-0000-4000-a000-000000000002";

    let concurrencyLineId!: string;
    let runLineAId!: string;
    let runLineBId!: string;

    await assert("setup: a document line with extracted_amount=100.00 and two target run lines", async () => {
      const doc = await createCommissionDocument({
        entityId: ENTITY_A, fileName: "concurrency-test.pdf", contentType: "application/pdf", fileSize: 512,
        sha256: "sha-concurrency", storageKey: "commission-documents/concurrency.pdf", storageProvider: "replit-object-storage",
        createdBy: "ci-test", idempotencyKey: "idem-concurrency",
      });
      const lineRows = await pool.query<{ id: string }>(`
        INSERT INTO commission_document_lines (document_id, line_index, extracted_amount, extracted_client_name)
        VALUES ($1::uuid, 0, 100.00, 'Concurrency Test Client') RETURNING id::text
      `, [doc.document.id]);
      concurrencyLineId = lineRows.rows[0].id;

      const runA = await pool.query<{ id: string }>(`
        INSERT INTO commission_run_lines (entity_id, invoice_id, invoice_qbo_id, invoice_amount, line_status, source_fingerprint)
        VALUES ($1::uuid, $2::uuid, 'QBO-CONC-A', 1000.00, 'attributed', 'ci-fp-conc-a') RETURNING id::text
      `, [ENTITY_A, CONCURRENCY_INVOICE_A]);
      runLineAId = runA.rows[0].id;

      const runB = await pool.query<{ id: string }>(`
        INSERT INTO commission_run_lines (entity_id, invoice_id, invoice_qbo_id, invoice_amount, line_status, source_fingerprint)
        VALUES ($1::uuid, $2::uuid, 'QBO-CONC-B', 1000.00, 'attributed', 'ci-fp-conc-b') RETURNING id::text
      `, [ENTITY_A, CONCURRENCY_INVOICE_B]);
      runLineBId = runB.rows[0].id;
    });

    await assert("two concurrent createAllocations calls (60.00 + 60.00, source=100.00): exactly one succeeds, one is rejected", async () => {
      const callA = createAllocations(
        concurrencyLineId,
        [{ commissionRunLineId: runLineAId, allocationMethod: "fixed_amount", allocatedAmount: "60.00", reason: "Concurrent call A" }],
        "ci-test-a",
      );
      const callB = createAllocations(
        concurrencyLineId,
        [{ commissionRunLineId: runLineBId, allocationMethod: "fixed_amount", allocatedAmount: "60.00", reason: "Concurrent call B" }],
        "ci-test-b",
      );

      const results = await withTimeout(Promise.allSettled([callA, callB]), 15_000, "concurrent createAllocations");
      const succeeded = results.filter((r) => r.status === "fulfilled");
      const rejected = results.filter((r) => r.status === "rejected");

      if (succeeded.length !== 1) throw new Error(`Expected exactly 1 success, got ${succeeded.length} (results: ${JSON.stringify(results)})`);
      if (rejected.length !== 1) throw new Error(`Expected exactly 1 rejection, got ${rejected.length}`);

      const rejectionReason = (rejected[0] as PromiseRejectedResult).reason;
      const code = (rejectionReason as { code?: string })?.code;
      if (code !== "ALLOCATION_EXCEEDS_SOURCE") throw new Error(`Expected ALLOCATION_EXCEEDS_SOURCE, got ${code} (${rejectionReason})`);

      // The FOR UPDATE lock is what makes this deterministic: the second
      // transaction only proceeds after the first commits, and re-reads the
      // (now updated) sum of active allocations before deciding — so it
      // correctly sees 60.00 already committed and refuses to add another 60.00.
      const active = await getAllocationsForDocumentLine(concurrencyLineId);
      const activeTotal = active.reduce((sum, a) => sum + parseFloat(a.allocatedAmount), 0);
      if (activeTotal > 100.0001) throw new Error(`Active allocation total ${activeTotal} exceeds source amount 100.00 — over-allocation guard failed under concurrency`);
      assertEqual(active.length, 1, "exactly one allocation persisted");
    });

    // ── 7. Rollback on partial batch failure ───────────────────────────────
    console.log("");
    console.log("── 7. Rollback on partial batch failure ─────────────────────────");

    await assert("a batch where the SECOND item fails a DB-level CHECK after the FIRST item's insert already ran rolls back the WHOLE transaction — no orphaned first allocation", async () => {
      // Both items pass every upfront JS-layer validation (valid UUID, known
      // allocation method, non-blank reason — createAllocations checks these
      // for ALL items before opening the transaction). The failure here is
      // deliberately deferred to the DB layer: allocated_amount <= 0 is only
      // rejected by the table's CHECK constraint, not by application code.
      // This means allocation #1's INSERT genuinely executes and only THEN
      // does allocation #2's INSERT fail — proving the transaction rolls
      // back an already-applied write, not merely skipping work it never did.
      const doc = await createCommissionDocument({
        entityId: ENTITY_A, fileName: "rollback-test.pdf", contentType: "application/pdf", fileSize: 512,
        sha256: "sha-rollback", storageKey: "commission-documents/rollback.pdf", storageProvider: "replit-object-storage",
        createdBy: "ci-test", idempotencyKey: "idem-rollback",
      });
      const lineRows = await pool.query<{ id: string }>(`
        INSERT INTO commission_document_lines (document_id, line_index, extracted_amount)
        VALUES ($1::uuid, 0, 200.00) RETURNING id::text
      `, [doc.document.id]);
      const lineId = lineRows.rows[0].id;
      const runA = await pool.query<{ id: string }>(`
        INSERT INTO commission_run_lines (entity_id, invoice_id, invoice_qbo_id, invoice_amount, line_status, source_fingerprint)
        VALUES ($1::uuid, gen_random_uuid(), 'QBO-ROLLBACK-A', 500.00, 'attributed', 'ci-fp-rollback-a') RETURNING id::text
      `, [ENTITY_A]);
      const runB = await pool.query<{ id: string }>(`
        INSERT INTO commission_run_lines (entity_id, invoice_id, invoice_qbo_id, invoice_amount, line_status, source_fingerprint)
        VALUES ($1::uuid, gen_random_uuid(), 'QBO-ROLLBACK-B', 500.00, 'attributed', 'ci-fp-rollback-b') RETURNING id::text
      `, [ENTITY_A]);

      let threw = false;
      try {
        await createAllocations(lineId, [
          { commissionRunLineId: runA.rows[0].id, allocationMethod: "fixed_amount", allocatedAmount: "50.00", reason: "First — insert executes, must be rolled back" },
          { commissionRunLineId: runB.rows[0].id, allocationMethod: "fixed_amount", allocatedAmount: "-10.00", reason: "Second — fails the allocated_amount > 0 CHECK at insert time" },
        ], "ci-test");
      } catch (e: unknown) {
        threw = true;
        const code = unwrapPgErrorCode(e);
        if (code !== "23514") throw new Error(`Expected the raw Postgres CHECK violation (23514) to propagate (possibly wrapped), got ${code}`);
      }
      if (!threw) throw new Error("Batch with a DB-level constraint violation on the second item should have thrown");

      const persisted = await getAllocationsForDocumentLine(lineId);
      assertEqual(persisted.length, 0, "no allocation persisted — the first item's already-executed insert was rolled back with the transaction");
    });

    // ── 8. Recalculation after allocation ──────────────────────────────────
    console.log("");
    console.log("── 8. Recalculation after allocation ────────────────────────────");

    await assert("recalculateRunLineAfterAllocation with a CONFIGURED rule computes a real commission_amount", async () => {
      const repRows = await pool.query<{ id: string }>(`
        INSERT INTO commission_representatives (slug, display_name, representative_type, payout_eligible)
        VALUES ('ci-configured-rep', 'CI Configured Rep', 'external_rep', true) RETURNING id::text
      `);
      const repId = repRows.rows[0].id;
      const ruleRows = await pool.query<{ id: string }>(`
        INSERT INTO commission_rules (entity_id, representative_id, formula_type, calculation_basis, commission_rate, payable_trigger)
        VALUES ($1::uuid, $2::uuid, 'percentage_of_gross_profit', 'gross_profit', 0.150000, 'invoice_paid')
        RETURNING id::text
      `, [ENTITY_A, repId]);
      const ruleId = ruleRows.rows[0].id;
      const runLineRows = await pool.query<{ id: string }>(`
        INSERT INTO commission_run_lines (entity_id, invoice_id, invoice_qbo_id, invoice_amount, invoice_status, representative_id, commission_rule_id, line_status, source_fingerprint)
        VALUES ($1::uuid, gen_random_uuid(), 'QBO-CONFIGURED', 500.00, 'paid', $2::uuid, $3::uuid, 'attributed', 'ci-fp-configured-recalc')
        RETURNING id::text
      `, [ENTITY_A, repId, ruleId]);
      const runLineId = runLineRows.rows[0].id;

      const docRows = await pool.query<{ id: string }>(`
        INSERT INTO commission_documents (entity_id, file_name, file_size, sha256, storage_key, storage_provider, created_by)
        VALUES ($1::uuid, 'configured-recalc.pdf', 100, 'sha-configured-recalc', 'key-configured-recalc', 'replit-object-storage', 'ci-test')
        RETURNING id::text
      `, [ENTITY_A]);
      const lineRows = await pool.query<{ id: string }>(`
        INSERT INTO commission_document_lines (document_id, line_index, extracted_amount)
        VALUES ($1::uuid, 0, 75.00) RETURNING id::text
      `, [docRows.rows[0].id]);

      await createAllocations(lineRows.rows[0].id, [
        { commissionRunLineId: runLineId, allocationMethod: "fixed_amount", allocatedAmount: "75.00", reason: "Precision Roofing 7.5% of $1,000 ad budget" },
      ], "ci-test");

      const result = await recalculateRunLineAfterAllocation(runLineId);
      assertEqual(result.configured, true, "configured");
      assertEqual(result.grossProfit, "425.00", "grossProfit = 500.00 - 75.00");
      if (result.commissionAmount == null) throw new Error("Expected a real commission_amount for a configured rule");
      assertEqual(result.commissionAmount, "63.75", "commissionAmount = 15% of 425.00");
    });

    await assert("recalculateRunLineAfterAllocation with NO commission rule at all (Jason's situation) never invents a rate", async () => {
      const runLineRows = await pool.query<{ id: string }>(`
        INSERT INTO commission_run_lines (entity_id, invoice_id, invoice_qbo_id, invoice_amount, invoice_status, line_status, source_fingerprint)
        VALUES ($1::uuid, gen_random_uuid(), 'QBO-UNCONFIGURED', 500.00, 'paid', 'attributed', 'ci-fp-unconfigured-recalc')
        RETURNING id::text
      `, [ENTITY_A]);
      const runLineId = runLineRows.rows[0].id;

      const docRows = await pool.query<{ id: string }>(`
        INSERT INTO commission_documents (entity_id, file_name, file_size, sha256, storage_key, storage_provider, created_by)
        VALUES ($1::uuid, 'unconfigured-recalc.pdf', 100, 'sha-unconfigured-recalc', 'key-unconfigured-recalc', 'replit-object-storage', 'ci-test')
        RETURNING id::text
      `, [ENTITY_A]);
      const lineRows = await pool.query<{ id: string }>(`
        INSERT INTO commission_document_lines (document_id, line_index, extracted_amount)
        VALUES ($1::uuid, 0, 75.00) RETURNING id::text
      `, [docRows.rows[0].id]);

      await createAllocations(lineRows.rows[0].id, [
        { commissionRunLineId: runLineId, allocationMethod: "fixed_amount", allocatedAmount: "75.00", reason: "CarDealer AI 7.5% of $1,000 ad budget" },
      ], "ci-test");

      const result = await recalculateRunLineAfterAllocation(runLineId);
      assertEqual(result.configured, false, "configured — no rule exists, must never be true");
      assertEqual(result.commissionAmount, null, "commissionAmount — must never be invented");
      assertEqual(result.lineStatus, "needs_configuration", "lineStatus");
      // The provisional math (gross profit) is still surfaced for the dashboard,
      // even though no commission can be computed from it.
      assertEqual(result.grossProfit, "425.00", "grossProfit still computed for display");
    });

    // ── Done ─────────────────────────────────────────────────────────────
    console.log("");
    console.log(`✅  All ${passed} tests passed.`);
    console.log("    No local database and no QBO connection was used.");
    console.log("    CORE_DATABASE_URL/DATABASE_URL were set to this same ephemeral");
    console.log("    container (see comment near COMMISSION_DATABASE_URL above) but were");
    console.log("    never queried through — no real Neon Core connection was made.");
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

main().catch((err) => {
  console.error("❌  Fatal:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
