/**
 * Transactional persistence for validated historical QBO matches.
 *
 * Writes to DATABASE_URL only.
 * Never modifies Plaid source transactions.
 * Never writes to QuickBooks/Core.
 * Never creates reconciliation records.
 * Manual FinanceOS categories always win.
 */
import { Pool } from "pg";
import type { QboHistoricalLine } from "./qboHistoricalImport.js";

const databaseUrl = process.env["DATABASE_URL"];
const coreUrl = process.env["CORE_DATABASE_URL"];

if (
  databaseUrl &&
  coreUrl &&
  databaseUrl === coreUrl
) {
  throw new Error(
    "bankingQboHistory: refusing to use Core DB as write target",
  );
}

const pool = databaseUrl
  ? new Pool({ connectionString: databaseUrl })
  : null;

export interface HistoricalQboMatchInput {
  plaidTransactionId: string;
  qboId: string;
  qboObjectType: string;
  dateDeltaDays: number;
  confidence: number;
  lines: QboHistoricalLine[];
}

export interface HistoricalQboImportResult {
  requestedMatchCount: number;
  importedMatchCount: number;
  importedLineCount: number;
  manualCategoryExcluded: number;
}

export async function importHistoricalQboMatches(params: {
  entitySlug: string;
  importedBy: string;
  matches: HistoricalQboMatchInput[];
}): Promise<HistoricalQboImportResult> {
  const entitySlug = params.entitySlug.trim();
  const importedBy = params.importedBy.trim();

  if (!entitySlug) throw new Error("entitySlug is required");
  if (!importedBy) throw new Error("importedBy is required");

  const seen = new Set<string>();

  for (const match of params.matches) {
    if (!match.plaidTransactionId.trim()) {
      throw new Error("plaidTransactionId is required");
    }
    if (!match.qboId.trim()) {
      throw new Error("qboId is required");
    }
    if (!match.qboObjectType.trim()) {
      throw new Error("qboObjectType is required");
    }
    if (
      !Number.isInteger(match.dateDeltaDays) ||
      match.dateDeltaDays < 0 ||
      match.dateDeltaDays > 3
    ) {
      throw new Error("dateDeltaDays must be between 0 and 3");
    }
    if (
      !Number.isFinite(match.confidence) ||
      match.confidence < 0 ||
      match.confidence > 1
    ) {
      throw new Error("confidence must be between 0 and 1");
    }
    if (match.lines.length === 0) {
      throw new Error("historical match must contain QBO lines");
    }
    if (seen.has(match.plaidTransactionId)) {
      throw new Error("duplicate plaidTransactionId in import batch");
    }

    seen.add(match.plaidTransactionId);
  }

  if (params.matches.length === 0) {
    return {
      requestedMatchCount: 0,
      importedMatchCount: 0,
      importedLineCount: 0,
      manualCategoryExcluded: 0,
    };
  }

  if (!pool) {
    throw new Error(
      "DATABASE_URL not configured — QBO history unavailable",
    );
  }

  const client = await pool.connect();

  try {
    await client.query(
      "BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE",
    );

    const transactionIds = params.matches.map(
      (match) => match.plaidTransactionId,
    );

    const manualResult = await client.query<{
      plaid_transaction_id: string;
    }>(
      `SELECT plaid_transaction_id
       FROM bank_transaction_categories
       WHERE entity_slug = $1
         AND plaid_transaction_id = ANY($2::text[])`,
      [entitySlug, transactionIds],
    );

    const manualIds = new Set(
      manualResult.rows.map(
        (row) => row.plaid_transaction_id,
      ),
    );

    let importedMatchCount = 0;
    let importedLineCount = 0;

    for (const match of params.matches) {
      if (manualIds.has(match.plaidTransactionId)) continue;

      const matchResult = await client.query<{ id: string }>(
        `INSERT INTO bank_transaction_qbo_matches
           (plaid_transaction_id, entity_slug, qbo_id,
            qbo_object_type, match_method, date_delta_days,
            confidence, review_status, source, imported_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,'matched','qbo_history',$8)
         ON CONFLICT (plaid_transaction_id, entity_slug)
         DO UPDATE SET
           qbo_id = EXCLUDED.qbo_id,
           qbo_object_type = EXCLUDED.qbo_object_type,
           match_method = EXCLUDED.match_method,
           date_delta_days = EXCLUDED.date_delta_days,
           confidence = EXCLUDED.confidence,
           review_status = 'matched',
           source = 'qbo_history',
           imported_by = EXCLUDED.imported_by,
           updated_at = NOW()
         RETURNING id`,
        [
          match.plaidTransactionId,
          entitySlug,
          match.qboId,
          match.qboObjectType,
          "mercury_amount_account_date_window",
          match.dateDeltaDays,
          match.confidence,
          importedBy,
        ],
      );

      const matchId = matchResult.rows[0]?.id;
      if (!matchId) {
        throw new Error("QBO match insert returned no id");
      }

      await client.query(
        `DELETE FROM bank_transaction_qbo_lines
         WHERE match_id = $1`,
        [matchId],
      );

      for (const line of match.lines) {
        await client.query(
          `INSERT INTO bank_transaction_qbo_lines
             (match_id, line_index, coa_account_id,
              coa_account_name, coa_account_type,
              qbo_class_id, qbo_class_name, line_amount,
              memo, raw_line)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb)`,
          [
            matchId,
            line.lineIndex,
            line.coaAccountId,
            line.coaAccountName,
            line.coaAccountType,
            line.qboClassId,
            line.qboClassName,
            line.lineAmount,
            line.memo,
            JSON.stringify(line.rawLine),
          ],
        );

        importedLineCount += 1;
      }

      importedMatchCount += 1;
    }

    await client.query("COMMIT");

    return {
      requestedMatchCount: params.matches.length,
      importedMatchCount,
      importedLineCount,
      manualCategoryExcluded: manualIds.size,
    };
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {}

    throw error;
  } finally {
    client.release();
  }
}
