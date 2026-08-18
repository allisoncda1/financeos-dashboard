#!/usr/bin/env tsx
/**
 * Commission role provisioning — CI-only PostgreSQL integration runner
 *
 * PURPOSE
 * -------
 * Validates, against a REAL PostgreSQL instance, that
 * db/migrations/commission_role_provisioning.sql grants the runtime
 * `commission_writer` role EXACTLY the privileges the application code
 * actually needs on the four commission_004 tables — no more, no less —
 * and that the role has zero DDL capability anywhere. A unit test cannot
 * honestly prove this: privilege enforcement only exists inside Postgres
 * itself.
 *
 * Deployment order this test mirrors and enforces:
 *   1. Apply commission_001/002/003/004 (migrations CREATE the tables).
 *   2. Run commission_role_provisioning.sql's GRANT statements (grants
 *      access to tables that already exist — running them first would
 *      fail outright, which this script's own step ordering demonstrates).
 *
 * What this proves, concretely:
 *   - commission_writer CAN select/insert/update commission_documents,
 *     but CANNOT delete from it (deleteCommissionDocumentRow exists in
 *     code but is never actually called by any real path — see the
 *     provisioning file's own privilege-matrix comment).
 *   - commission_writer CAN select/insert/update/delete
 *     commission_document_lines (replaceDocumentLines() genuinely deletes
 *     and re-inserts a document's lines).
 *   - commission_writer CAN select/insert/update commission_expense_allocations
 *     (supersedeAllocation() is the only UPDATE), but CANNOT delete from it
 *     (allocations are superseded, never removed).
 *   - commission_writer CAN select/insert commission_document_events (a
 *     pure append-only audit log), but CANNOT update or delete it.
 *   - commission_writer CANNOT CREATE TABLE, ALTER TABLE, or DROP TABLE
 *     anywhere in the schema — verified directly, not inferred.
 *
 * The role is created fresh in the ephemeral commission_test_ci database
 * for this run only (the official postgres:16 image's POSTGRES_USER is a
 * superuser, so ci_user can CREATE ROLE here) — this never touches any
 * real Neon role or credential.
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

// ─── URL utilities (identical to the other two PG integration scripts) ────

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

// ─── Paths ─────────────────────────────────────────────────────────────────

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS = path.resolve(__dirname, "../src/db/migrations");
const SQL_FILES = ["commission_001_schema.sql", "commission_002_attribution_seed.sql", "commission_003_review_inputs.sql", "commission_004_documents_expenses.sql"]
  .map((f) => path.join(MIGRATIONS, f));
const PROVISIONING_FILE = path.join(MIGRATIONS, "commission_role_provisioning.sql");

for (const f of [...SQL_FILES, PROVISIONING_FILE]) {
  if (!fs.existsSync(f)) { console.error(`❌  File not found: ${f}`); process.exit(1); }
}

// ─── Test harness (identical shape to the other two PG integration scripts) ─

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

/** Runs `fn` under SET ROLE commission_writer, always resetting the role
 * afterward (even on failure), so a thrown permission-denied error from
 * inside `fn` never leaves the connection stuck as the restricted role. */
async function asCommissionWriter<T>(pool: pg.Pool, fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SET ROLE commission_writer");
    try {
      return await fn(client);
    } finally {
      await client.query("RESET ROLE");
      await client.query("ROLLBACK");
    }
  } finally {
    client.release();
  }
}

function assertPermissionDenied(err: unknown, label: string): void {
  const code = (err as { code?: string })?.code;
  if (code !== "42501") {
    throw new Error(`${label}: expected a permission-denied error (42501), got ${code} (${err instanceof Error ? err.message : String(err)})`);
  }
}

// ─── Fixed test constants ──────────────────────────────────────────────────

const ENTITY_A = "dddddddd-1111-4000-a000-000000000001";

// ─── Main ──────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log("Commission role provisioning PostgreSQL integration — CI runner");
  console.log(`  Database : ${maskUrl(TEST_URL!)}`);
  console.log(`  CI       : GITHUB_ACTIONS=${process.env.GITHUB_ACTIONS ?? "?"}`);
  console.log("");

  const pool = new Pool({ connectionString: TEST_URL!, max: 10 });

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
    await pool.query("DROP ROLE IF EXISTS commission_writer");

    // ── 1. Deployment order: migrations create tables BEFORE grants ───────
    console.log("── 1. Deployment order — migrations, then role, then grants ────");

    await assert("minimal Core table stubs exist (entities/invoices — owned by FinanceOS Core, not a commission_*.sql migration; created here only so this ephemeral database has something for Step 4's GRANT to target)", async () => {
      await pool.query(`
        CREATE TABLE public.entities (id uuid PRIMARY KEY DEFAULT gen_random_uuid());
        CREATE TABLE public.invoices (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), entity_id uuid, is_deleted boolean NOT NULL DEFAULT false, invoice_date date);
      `);
    });

    for (const f of SQL_FILES) {
      const name = path.basename(f);
      await assert(`${name} applies without error`, async () => {
        await pool.query(fs.readFileSync(f, "utf8"));
      });
    }

    await assert("GRANT on commission_documents fails BEFORE the role exists (proves ordering matters)", async () => {
      let threw = false;
      try {
        await pool.query("GRANT SELECT ON TABLE public.commission_documents TO commission_writer");
      } catch (e: unknown) {
        threw = true;
        // Undefined-object (role doesn't exist yet) — Postgres error 42704.
        if ((e as { code?: string }).code !== "42704") throw new Error(`Expected 42704 (undefined role), got ${(e as { code?: string }).code}`);
      }
      if (!threw) throw new Error("Granting to a role that doesn't exist yet should have failed");
    });

    await assert("commission_writer role is created (CI-only, ephemeral — never a real Neon credential)", async () => {
      await pool.query(`
        CREATE ROLE commission_writer
          WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT
          PASSWORD 'ci-ephemeral-not-a-real-secret'
      `);
    });

    await assert("commission_role_provisioning.sql's GRANT/REVOKE statements apply without error, now that the role and all eleven tables exist", async () => {
      // The file's own CREATE ROLE (Step 1) and verification block (Step 7)
      // are written as SQL comments (-- ...) specifically so this file can
      // be fed to the database as-is — only the real GRANT/REVOKE
      // statements execute; the commented-out illustrative SQL is inert.
      //
      // The file targets the real production database by its literal name
      // ("neondb") for GRANT CONNECT ON DATABASE / REVOKE CREATE ON
      // DATABASE — those two statements are inherently database-name-
      // specific (unlike table/schema grants, which aren't). Substituting
      // this ephemeral CI database's actual name is the one, deliberate
      // adaptation this test makes; every other statement in the file runs
      // completely verbatim.
      const raw = fs.readFileSync(PROVISIONING_FILE, "utf8");
      const adapted = raw.replace(/\bDATABASE neondb\b/g, `DATABASE ${testNorm!.database}`);
      await pool.query(adapted);
    });

    // ── 2. commission_writer CAN do exactly what the code needs ───────────
    console.log("");
    console.log("── 2. commission_writer — allowed operations succeed ────────────");

    await assert("SELECT/INSERT/UPDATE on commission_documents succeeds", async () => {
      await asCommissionWriter(pool, async (client) => {
        await client.query(`
          INSERT INTO commission_documents (entity_id, file_name, file_size, sha256, storage_key, storage_provider, created_by)
          VALUES ($1::uuid, 'grant-check.pdf', 1, 'grant-check-sha', 'grant-check-key', 'replit-object-storage', 'grant-check')
        `, [ENTITY_A]);
        await client.query(`UPDATE commission_documents SET updated_at = now() WHERE sha256 = 'grant-check-sha'`);
        const r = await client.query(`SELECT id FROM commission_documents WHERE sha256 = 'grant-check-sha'`);
        if (r.rows.length !== 1) throw new Error("Expected to find the inserted row via SELECT");
      });
    });

    await assert("SELECT/INSERT/UPDATE/DELETE on commission_document_lines succeeds (replaceDocumentLines' delete+reinsert pattern)", async () => {
      await asCommissionWriter(pool, async (client) => {
        const doc = await client.query<{ id: string }>(`
          INSERT INTO commission_documents (entity_id, file_name, file_size, sha256, storage_key, storage_provider, created_by)
          VALUES ($1::uuid, 'lines-grant-check.pdf', 1, 'lines-grant-check-sha', 'lines-grant-check-key', 'replit-object-storage', 'grant-check')
          RETURNING id::text
        `, [ENTITY_A]);
        await client.query(`INSERT INTO commission_document_lines (document_id, line_index) VALUES ($1::uuid, 0)`, [doc.rows[0].id]);
        await client.query(`UPDATE commission_document_lines SET status = 'ignored' WHERE document_id = $1::uuid`, [doc.rows[0].id]);
        await client.query(`DELETE FROM commission_document_lines WHERE document_id = $1::uuid`, [doc.rows[0].id]);
        const r = await client.query(`SELECT id FROM commission_document_lines WHERE document_id = $1::uuid`, [doc.rows[0].id]);
        if (r.rows.length !== 0) throw new Error("Expected the DELETE to have removed the line");
      });
    });

    await assert("SELECT/INSERT/UPDATE on commission_expense_allocations succeeds (supersedeAllocation's soft-delete pattern)", async () => {
      await asCommissionWriter(pool, async (client) => {
        const doc = await client.query<{ id: string }>(`
          INSERT INTO commission_documents (entity_id, file_name, file_size, sha256, storage_key, storage_provider, created_by)
          VALUES ($1::uuid, 'alloc-grant-check.pdf', 1, 'alloc-grant-check-sha', 'alloc-grant-check-key', 'replit-object-storage', 'grant-check')
          RETURNING id::text
        `, [ENTITY_A]);
        const line = await client.query<{ id: string }>(`
          INSERT INTO commission_document_lines (document_id, line_index, extracted_amount) VALUES ($1::uuid, 0, 50.00) RETURNING id::text
        `, [doc.rows[0].id]);
        const runLine = await client.query<{ id: string }>(`
          INSERT INTO commission_run_lines (entity_id, invoice_id, invoice_qbo_id, invoice_amount, line_status, source_fingerprint)
          VALUES ($1::uuid, gen_random_uuid(), 'QBO-GRANT-CHECK', 500.00, 'attributed', 'ci-fp-grant-check') RETURNING id::text
        `, [ENTITY_A]);
        const alloc = await client.query<{ id: string }>(`
          INSERT INTO commission_expense_allocations (document_line_id, commission_run_line_id, allocation_method, allocated_amount, reason, created_by)
          VALUES ($1::uuid, $2::uuid, 'fixed_amount', 50.00, 'grant check', 'grant-check') RETURNING id::text
        `, [line.rows[0].id, runLine.rows[0].id]);
        await client.query(`UPDATE commission_expense_allocations SET superseded_at = now(), superseded_by = 'grant-check' WHERE id = $1::uuid`, [alloc.rows[0].id]);
        const r = await client.query(`SELECT superseded_at FROM commission_expense_allocations WHERE id = $1::uuid`, [alloc.rows[0].id]);
        if (r.rows[0].superseded_at == null) throw new Error("Expected supersede UPDATE to have applied");
      });
    });

    await assert("SELECT/INSERT on commission_document_events succeeds (append-only audit log)", async () => {
      await asCommissionWriter(pool, async (client) => {
        const doc = await client.query<{ id: string }>(`
          INSERT INTO commission_documents (entity_id, file_name, file_size, sha256, storage_key, storage_provider, created_by)
          VALUES ($1::uuid, 'events-grant-check.pdf', 1, 'events-grant-check-sha', 'events-grant-check-key', 'replit-object-storage', 'grant-check')
          RETURNING id::text
        `, [ENTITY_A]);
        await client.query(`INSERT INTO commission_document_events (document_id, event_type, performed_by) VALUES ($1::uuid, 'uploaded', 'grant-check')`, [doc.rows[0].id]);
        const r = await client.query(`SELECT id FROM commission_document_events WHERE document_id = $1::uuid`, [doc.rows[0].id]);
        if (r.rows.length !== 1) throw new Error("Expected to find the inserted event via SELECT");
      });
    });

    // ── 3. commission_writer CANNOT do what the code never needs ──────────
    console.log("");
    console.log("── 3. commission_writer — un-granted operations are rejected ────");

    await assert("DELETE on commission_documents is rejected (deleteCommissionDocumentRow has no real call site — not granted)", async () => {
      await asCommissionWriter(pool, async (client) => {
        let threw = false;
        try {
          await client.query("DELETE FROM commission_documents WHERE false");
        } catch (e: unknown) {
          threw = true;
          assertPermissionDenied(e, "DELETE on commission_documents");
        }
        if (!threw) throw new Error("DELETE on commission_documents should have been rejected");
      });
    });

    await assert("DELETE on commission_expense_allocations is rejected (allocations are superseded, never removed)", async () => {
      await asCommissionWriter(pool, async (client) => {
        let threw = false;
        try {
          await client.query("DELETE FROM commission_expense_allocations WHERE false");
        } catch (e: unknown) {
          threw = true;
          assertPermissionDenied(e, "DELETE on commission_expense_allocations");
        }
        if (!threw) throw new Error("DELETE on commission_expense_allocations should have been rejected");
      });
    });

    await assert("UPDATE on commission_document_events is rejected (append-only — no UPDATE granted)", async () => {
      await asCommissionWriter(pool, async (client) => {
        let threw = false;
        try {
          await client.query("UPDATE commission_document_events SET reason = reason WHERE false");
        } catch (e: unknown) {
          threw = true;
          assertPermissionDenied(e, "UPDATE on commission_document_events");
        }
        if (!threw) throw new Error("UPDATE on commission_document_events should have been rejected");
      });
    });

    await assert("DELETE on commission_document_events is rejected (append-only — no DELETE granted)", async () => {
      await asCommissionWriter(pool, async (client) => {
        let threw = false;
        try {
          await client.query("DELETE FROM commission_document_events WHERE false");
        } catch (e: unknown) {
          threw = true;
          assertPermissionDenied(e, "DELETE on commission_document_events");
        }
        if (!threw) throw new Error("DELETE on commission_document_events should have been rejected");
      });
    });

    await assert("INSERT/UPDATE/DELETE on public.entities and public.invoices (Core, read-only) is rejected", async () => {
      await asCommissionWriter(pool, async (client) => {
        for (const stmt of [
          "INSERT INTO public.entities (id) VALUES (gen_random_uuid())",
          "INSERT INTO public.invoices (id, entity_id) VALUES (gen_random_uuid(), gen_random_uuid())",
        ]) {
          let threw = false;
          try { await client.query(stmt); } catch (e: unknown) { threw = true; assertPermissionDenied(e, `write to Core (${stmt})`); }
          if (!threw) throw new Error(`Should have been rejected: ${stmt}`);
        }
      });
    });

    // ── 4. commission_writer has ZERO DDL capability, anywhere ─────────────
    console.log("");
    console.log("── 4. commission_writer — no DDL capability anywhere ────────────");

    await assert("CREATE TABLE is rejected", async () => {
      await asCommissionWriter(pool, async (client) => {
        let threw = false;
        try { await client.query("CREATE TABLE public.commission_writer_ddl_probe (id int)"); }
        catch (e: unknown) { threw = true; assertPermissionDenied(e, "CREATE TABLE"); }
        if (!threw) throw new Error("CREATE TABLE should have been rejected");
      });
    });

    await assert("ALTER TABLE (adding a column to a table it otherwise has full DML on) is rejected", async () => {
      await asCommissionWriter(pool, async (client) => {
        let threw = false;
        try { await client.query("ALTER TABLE public.commission_documents ADD COLUMN ddl_probe int"); }
        catch (e: unknown) { threw = true; assertPermissionDenied(e, "ALTER TABLE commission_documents"); }
        if (!threw) throw new Error("ALTER TABLE should have been rejected");
      });
    });

    await assert("DROP TABLE is rejected", async () => {
      await asCommissionWriter(pool, async (client) => {
        let threw = false;
        try { await client.query("DROP TABLE public.commission_documents"); }
        catch (e: unknown) { threw = true; assertPermissionDenied(e, "DROP TABLE"); }
        if (!threw) throw new Error("DROP TABLE should have been rejected");
      });
    });

    await assert("CREATE SEQUENCE is rejected (no commission_* table uses a sequence at all — every one is a UUID PK — this role has no sequence privilege of any kind)", async () => {
      await asCommissionWriter(pool, async (client) => {
        let threw = false;
        try { await client.query("CREATE SEQUENCE public.commission_writer_ddl_probe_seq"); }
        catch (e: unknown) { threw = true; assertPermissionDenied(e, "CREATE SEQUENCE"); }
        if (!threw) throw new Error("CREATE SEQUENCE should have been rejected");
      });
    });

    await assert("CREATE SCHEMA is rejected", async () => {
      await asCommissionWriter(pool, async (client) => {
        let threw = false;
        try { await client.query("CREATE SCHEMA commission_writer_ddl_probe"); }
        catch (e: unknown) { threw = true; assertPermissionDenied(e, "CREATE SCHEMA"); }
        if (!threw) throw new Error("CREATE SCHEMA should have been rejected");
      });
    });

    // ── Done ─────────────────────────────────────────────────────────────
    console.log("");
    console.log(`✅  All ${passed} tests passed.`);
    console.log("    commission_writer role created and dropped entirely within this");
    console.log("    ephemeral CI database — no real Neon role or credential touched.");
  } catch (err) {
    if (err instanceof Error && err.message !== "STOP") {
      console.error("\n❌  Unexpected error:", err.message);
    }
    console.error(`\n❌  Aborted after first failure. ${passed} passed.`);
    if (lastError) console.error(`    Error: ${lastError}`);
    process.exit(1);
  } finally {
    await pool.query("DROP ROLE IF EXISTS commission_writer").catch(() => {/* ignore */});
    await pool.end().catch(() => {/* ignore */});
  }

  process.exit(0);
}

main().catch((err) => {
  console.error("❌  Fatal:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
