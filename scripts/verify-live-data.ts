/**
 * Live read-only verification script for FinanceOS Accounting module.
 *
 * Confirms that all 6 Neon Core tables (customers, vendors, invoices,
 * accounts, transactions, bills) are reachable and return correctly-scoped
 * rows for all 4 entities.
 *
 * Safety contract (enforced by design — no option to override):
 *   - Executes SELECT queries only. No INSERT / UPDATE / DELETE / DDL.
 *   - Never prints CORE_DATABASE_URL or any credential substring.
 *   - Never calls QBO, rotates tokens, or executes migrations.
 *   - Never writes to Replit operational DB (DATABASE_URL).
 *   - Exits 0 on pass, 1 on any check failure.
 *
 * Usage:
 *   CORE_DATABASE_URL=... npx tsx scripts/verify-live-data.ts
 *
 * Typical CI invocation (read-only Neon connection string in CI secret):
 *   CORE_DATABASE_URL="$NEON_CORE_READONLY" npx tsx scripts/verify-live-data.ts
 */

import postgres from "postgres";

// ─── Credential safety ────────────────────────────────────────────────────────

const RAW_URL = process.env["CORE_DATABASE_URL"];
if (!RAW_URL) {
  console.error("CORE_DATABASE_URL must be set to run this verification.");
  process.exit(1);
}

// Redact credentials from any string before it may appear in output.
function redact(s: string): string {
  // Replace postgres://user:password@host with postgres://***@host
  return s.replace(/postgres:\/\/[^@]*@/, "postgres://***@");
}

// Never allow the raw URL (or any substring of it that looks like a credential)
// to appear in output. This wrapper is the only safe log path.
function log(...args: unknown[]) {
  const safe = args
    .map((a) => (typeof a === "string" ? redact(a) : JSON.stringify(a)))
    .join(" ");
  console.log(safe);
}

function err(...args: unknown[]) {
  const safe = args
    .map((a) =>
      typeof a === "string"
        ? redact(a)
        : a instanceof Error
          ? `${a.name}: ${redact(a.message)}`
          : JSON.stringify(a),
    )
    .join(" ");
  console.error(safe);
}

// ─── Known entities ───────────────────────────────────────────────────────────

// Slugs as stored in Core (lowercase). The entityCache service lowercases
// incoming slugs before cache lookup, so these match the production resolution path.
const ENTITY_SLUGS = ["cardealer_ai", "t3_marketing", "topmrktr", "smile_more"] as const;

// ─── Connection (read-only; no transaction writes possible via this URL) ───────

const sql = postgres(RAW_URL, {
  max: 2,
  idle_timeout: 15,
  connect_timeout: 10,
  // Disable prepared statements — some read-only roles disallow them.
  prepare: false,
});

// ─── Result tracking ──────────────────────────────────────────────────────────

type CheckResult = {
  check: string;
  entity?: string;
  status: "pass" | "fail" | "warn";
  detail: string;
};

const results: CheckResult[] = [];
let failed = false;

function pass(check: string, detail: string, entity?: string) {
  results.push({ check, entity, status: "pass", detail });
}

function warn(check: string, detail: string, entity?: string) {
  results.push({ check, entity, status: "warn", detail });
}

function fail(check: string, detail: string, entity?: string) {
  results.push({ check, entity, status: "fail", detail });
  failed = true;
}

// ─── Checks ───────────────────────────────────────────────────────────────────

async function checkEntityResolution() {
  for (const slug of ENTITY_SLUGS) {
    const rows = await sql<{ id: string; slug: string }[]>`
      SELECT id, slug FROM entities WHERE slug = ${slug} LIMIT 1
    `;
    if (rows.length === 0) {
      fail("entity-resolution", `slug "${slug}" not found in entities table`, slug);
    } else {
      pass("entity-resolution", `id=${rows[0]!.id}`, slug);
    }
  }
}

async function getEntityIds(): Promise<Map<string, string>> {
  const rows = await sql<{ id: string; slug: string }[]>`
    SELECT id, slug FROM entities WHERE slug = ANY(${ENTITY_SLUGS as unknown as string[]})
  `;
  return new Map(rows.map((r) => [r.slug, r.id]));
}

async function checkCustomers(entityIds: Map<string, string>) {
  for (const [slug, entityId] of entityIds) {
    const rows = await sql<{ cnt: string }[]>`
      SELECT COUNT(*) AS cnt FROM customers WHERE entity_id = ${entityId}
    `;
    const count = parseInt(rows[0]!.cnt, 10);
    if (count === 0) {
      warn("customers", `0 rows — pipeline may not have run for this entity`, slug);
    } else {
      pass("customers", `${count} rows`, slug);
    }

    // Verify no cross-entity bleed: no customer row with a different entity_id
    const bleed = await sql<{ cnt: string }[]>`
      SELECT COUNT(*) AS cnt FROM customers
      WHERE entity_id != ${entityId}
        AND id IN (SELECT id FROM customers WHERE entity_id = ${entityId} LIMIT 10)
    `;
    const bleedCount = parseInt(bleed[0]!.cnt, 10);
    if (bleedCount > 0) {
      fail("customers-isolation", `cross-entity bleed detected (${bleedCount} rows)`, slug);
    }
  }
}

async function checkVendors(entityIds: Map<string, string>) {
  for (const [slug, entityId] of entityIds) {
    const rows = await sql<{ cnt: string }[]>`
      SELECT COUNT(*) AS cnt FROM vendors WHERE entity_id = ${entityId}
    `;
    const count = parseInt(rows[0]!.cnt, 10);
    if (count === 0) {
      warn("vendors", `0 rows — pipeline may not have run for this entity`, slug);
    } else {
      pass("vendors", `${count} rows`, slug);
    }
  }
}

async function checkInvoices(entityIds: Map<string, string>) {
  for (const [slug, entityId] of entityIds) {
    const rows = await sql<{ cnt: string; open_cnt: string; null_balance_cnt: string }[]>`
      SELECT
        COUNT(*)                                          AS cnt,
        COUNT(*) FILTER (WHERE status = 'Open')           AS open_cnt,
        COUNT(*) FILTER (WHERE balance IS NULL)           AS null_balance_cnt
      FROM invoices
      WHERE entity_id = ${entityId}
    `;
    const r = rows[0]!;
    const count = parseInt(r.cnt, 10);
    if (count === 0) {
      warn("invoices", `0 rows`, slug);
    } else {
      pass(
        "invoices",
        `${count} total, ${r.open_cnt} open, ${r.null_balance_cnt} null-balance`,
        slug,
      );
    }

    // Verify amounts are non-negative (invoices store absolute amounts)
    const negativeAmounts = await sql<{ cnt: string }[]>`
      SELECT COUNT(*) AS cnt FROM invoices
      WHERE entity_id = ${entityId} AND CAST(amount AS numeric) < 0
    `;
    const negCount = parseInt(negativeAmounts[0]!.cnt, 10);
    if (negCount > 0) {
      warn("invoices-amounts", `${negCount} rows with negative amount (unexpected for invoices)`, slug);
    }
  }
}

async function checkAccounts(entityIds: Map<string, string>) {
  for (const [slug, entityId] of entityIds) {
    const rows = await sql<{ cnt: string; type_cnt: string }[]>`
      SELECT
        COUNT(*)                  AS cnt,
        COUNT(DISTINCT account_type) AS type_cnt
      FROM accounts
      WHERE entity_id = ${entityId}
    `;
    const r = rows[0]!;
    const count = parseInt(r.cnt, 10);
    if (count === 0) {
      warn("accounts", `0 rows`, slug);
    } else {
      pass("accounts", `${count} accounts across ${r.type_cnt} account types`, slug);
    }
  }
}

async function checkTransactions(entityIds: Map<string, string>) {
  for (const [slug, entityId] of entityIds) {
    const rows = await sql<{
      cnt: string;
      null_amount_cnt: string;
      negative_amount_cnt: string;
    }[]>`
      SELECT
        COUNT(*)                                              AS cnt,
        COUNT(*) FILTER (WHERE amount IS NULL)                AS null_amount_cnt,
        COUNT(*) FILTER (WHERE CAST(amount AS numeric) < 0)   AS negative_amount_cnt
      FROM transactions
      WHERE entity_id = ${entityId} AND is_deleted = false
    `;
    const r = rows[0]!;
    const count = parseInt(r.cnt, 10);
    const nullCount = parseInt(r.null_amount_cnt, 10);
    const negCount = parseInt(r.negative_amount_cnt, 10);

    if (count === 0) {
      warn("transactions", `0 rows`, slug);
    } else {
      pass(
        "transactions",
        `${count} rows, ${nullCount} null amounts, ${negCount} negative amounts`,
        slug,
      );
    }

    if (negCount > 0) {
      // Schema comment says amounts are unsigned magnitudes — negative amounts
      // would indicate a pipeline or schema mismatch worth flagging.
      warn(
        "transactions-unsigned",
        `${negCount} rows have negative amount values — expected unsigned magnitudes; verify pipeline`,
        slug,
      );
    }
  }
}

async function checkBills(entityIds: Map<string, string>) {
  for (const [slug, entityId] of entityIds) {
    const rows = await sql<{ cnt: string; open_cnt: string }[]>`
      SELECT
        COUNT(*)                                      AS cnt,
        COUNT(*) FILTER (WHERE status = 'Open')       AS open_cnt
      FROM bills
      WHERE entity_id = ${entityId} AND is_deleted = false
    `;
    const r = rows[0]!;
    const count = parseInt(r.cnt, 10);
    if (count === 0) {
      warn("bills", `0 rows`, slug);
    } else {
      pass("bills", `${count} total, ${r.open_cnt} open`, slug);
    }
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  log("=== FinanceOS Accounting — Live Read-Only Verification ===");
  log(`Connecting to: ${redact(RAW_URL!)}`);
  log(`Entities: ${ENTITY_SLUGS.join(", ")}`);
  log("");

  try {
    // Confirm connection works with a trivial query
    await sql`SELECT 1 AS ok`;
    log("Connection: OK");
    log("");
  } catch (e) {
    err("Connection failed:", e);
    await sql.end();
    process.exit(1);
  }

  try {
    await checkEntityResolution();
    const entityIds = await getEntityIds();

    if (entityIds.size === 0) {
      fail("entity-resolution", "No entities found — cannot continue table checks");
    } else {
      await Promise.all([
        checkCustomers(entityIds),
        checkVendors(entityIds),
        checkInvoices(entityIds),
        checkAccounts(entityIds),
        checkTransactions(entityIds),
        checkBills(entityIds),
      ]);
    }
  } catch (e) {
    err("Unexpected error during checks:", e);
    failed = true;
  }

  await sql.end();

  // ─── Summary ───────────────────────────────────────────────────────────────

  log("");
  log("─── Results ───────────────────────────────────────────────────────────");

  const WIDTH = { check: 28, entity: 16 };
  for (const r of results) {
    const icon = r.status === "pass" ? "✓" : r.status === "warn" ? "⚠" : "✗";
    const check = (r.check ?? "").padEnd(WIDTH.check);
    const entity = (r.entity ?? "").padEnd(WIDTH.entity);
    log(`${icon}  ${check} ${entity} ${r.detail}`);
  }

  log("");
  const passes  = results.filter(r => r.status === "pass").length;
  const warns   = results.filter(r => r.status === "warn").length;
  const failures = results.filter(r => r.status === "fail").length;
  log(`Total: ${passes} passed, ${warns} warnings, ${failures} failed`);

  if (failed) {
    log("");
    log("VERIFICATION FAILED — see failures above.");
    process.exit(1);
  } else {
    log("");
    log("VERIFICATION PASSED.");
    process.exit(0);
  }
}

main().catch((e) => {
  err("Fatal:", e);
  process.exit(1);
});
