/**
 * bankingCategories.ts
 *
 * FinanceOS categorization metadata for bank transactions.
 * Writes to DATABASE_URL (heliumdb) only.
 * Never modifies bank_transactions (Plaid source data).
 * Never creates journal entries or reconciliation records.
 *
 * ops-connection.ts uses COMMISSION_DATABASE_URL — it must not be imported here.
 */
import { Pool } from "pg";

// ─── Fail-closed connection guard ─────────────────────────────────────────────
// Refuse to initialize if DATABASE_URL and CORE_DATABASE_URL are identical —
// that would allow writes to the read-only Core database.
// Neither URL is printed in the error message.
const _dbUrl   = process.env["DATABASE_URL"];
const _coreUrl = process.env["CORE_DATABASE_URL"];
if (_dbUrl && _coreUrl && _dbUrl === _coreUrl) {
  throw new Error(
    "bankingCategories: DATABASE_URL and CORE_DATABASE_URL must not be identical — " +
    "refusing to initialize write pool to prevent accidental Core DB writes",
  );
}

const _pool = _dbUrl ? new Pool({ connectionString: _dbUrl }) : null;

function _query<T extends object = Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
): Promise<{ rows: T[] }> {
  if (!_pool) throw new Error("DATABASE_URL not configured — bankingCategories unavailable");
  return _pool.query<T>(sql, params);
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TxCategory {
  plaidTransactionId: string;
  entitySlug:         string;
  coaAccountId:       string;
  coaAccountName:     string | null;
  coaAccountType:     string | null;
  categorizedBy:      string;
  note:               string | null;
  updatedAt:          string;
}

const COLS = `plaid_transaction_id, entity_slug, coa_account_id,
  coa_account_name, coa_account_type, categorized_by, note, updated_at`;

function mapRow(r: Record<string, unknown>): TxCategory {
  return {
    plaidTransactionId: String(r["plaid_transaction_id"]),
    entitySlug:         String(r["entity_slug"]),
    coaAccountId:       String(r["coa_account_id"]),
    coaAccountName:     (r["coa_account_name"] as string | null) ?? null,
    coaAccountType:     (r["coa_account_type"] as string | null) ?? null,
    categorizedBy:      String(r["categorized_by"]),
    note:               (r["note"] as string | null) ?? null,
    updatedAt:          String(r["updated_at"]),
  };
}

// ─── Public helpers ───────────────────────────────────────────────────────────

/**
 * Returns a map keyed by plaid_transaction_id for the given entity.
 * Callers must enforce the txIds cap (route enforces ≤200) before calling.
 */
export async function getCategoryMap(
  entitySlug: string,
  txIds: string[],
): Promise<Record<string, TxCategory>> {
  if (!txIds.length) return {};
  const placeholders = txIds.map((_, i) => `$${i + 2}`).join(", ");
  const res = await _query<Record<string, unknown>>(
    `SELECT ${COLS}
     FROM bank_transaction_categories
     WHERE entity_slug = $1
       AND plaid_transaction_id IN (${placeholders})`,
    [entitySlug, ...txIds],
  );
  const map: Record<string, TxCategory> = {};
  for (const r of res.rows) map[String(r["plaid_transaction_id"])] = mapRow(r);
  return map;
}

/**
 * Verifies a plaid_transaction_id belongs to the stated entity.
 * Reads bank_transactions (source). Never writes to it.
 */
export async function verifyTransactionEntity(
  plaidTransactionId: string,
  entitySlug: string,
): Promise<"ok" | "not_found" | "wrong_entity"> {
  const res = await _query<{ entity_slug: string }>(
    "SELECT entity_slug FROM bank_transactions WHERE plaid_transaction_id = $1 LIMIT 1",
    [plaidTransactionId],
  );
  if (!res.rows.length) return "not_found";
  return res.rows[0].entity_slug === entitySlug ? "ok" : "wrong_entity";
}

/**
 * Inserts or updates a FinanceOS category record.
 * coaAccountId/Name/Type must already be verified by the caller against Core.
 * categorizedBy must be the authenticated user's stable ID (AuthUser.id).
 */
export async function upsertCategory(params: {
  plaidTransactionId: string;
  entitySlug:         string;
  coaAccountId:       string;
  coaAccountName:     string | null;
  coaAccountType:     string | null;
  categorizedBy:      string;
  note:               string | null;
}): Promise<TxCategory> {
  const res = await _query<Record<string, unknown>>(
    `INSERT INTO bank_transaction_categories
       (plaid_transaction_id, entity_slug, coa_account_id,
        coa_account_name, coa_account_type, categorized_by, note)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     ON CONFLICT (plaid_transaction_id, entity_slug) DO UPDATE SET
       coa_account_id   = EXCLUDED.coa_account_id,
       coa_account_name = EXCLUDED.coa_account_name,
       coa_account_type = EXCLUDED.coa_account_type,
       categorized_by   = EXCLUDED.categorized_by,
       note             = EXCLUDED.note,
       updated_at       = NOW()
     RETURNING ${COLS}`,
    [
      params.plaidTransactionId, params.entitySlug,     params.coaAccountId,
      params.coaAccountName,     params.coaAccountType, params.categorizedBy,
      params.note,
    ],
  );
  const row = res.rows[0];
  if (!row) throw new Error("upsertCategory: DB returned no row");
  return mapRow(row);
}
