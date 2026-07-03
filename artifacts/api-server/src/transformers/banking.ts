import { driveLoadCsv } from "../lib/driveLoader";
import type { EntitySlug, BankingData, BankAccount, BankTransaction } from "../lib/types";

function toNumber(value: unknown): number {
  const parsed = parseFloat(String(value ?? ""));
  return isNaN(parsed) ? 0 : parsed;
}

function warnMissingColumns(
  rows: Record<string, string>[],
  expectedColumns: string[],
  source: string,
): void {
  if (rows.length === 0) return;
  const actualColumns = new Set(Object.keys(rows[0] ?? {}));
  const missing = expectedColumns.filter((col) => !actualColumns.has(col));
  if (missing.length > 0) {
    console.warn(
      `[transformBanking] ${source} is missing expected column(s): ${missing.join(", ")}. Found: ${Array.from(actualColumns).join(", ")}`,
    );
  }
}

function toBoolean(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value.trim().toLowerCase() === "true";
  return false;
}

function parseLastFour(accountName: string): string {
  const match = accountName.match(/\((\d{4})\)/);
  return match?.[1] ?? "";
}

function parseInstitution(accountName: string): string {
  return accountName
    .replace(/\s*\(\d+\)/, "")
    .replace(/\s*-\s*\d+$/, "")
    .trim();
}

/**
 * accounts_enriched.csv is the full QBO chart of accounts, not just bank
 * accounts: entity,account_id,account_name,account_type,account_subtype,active,current_balance
 * Only rows with account_type "Bank" represent real bank accounts.
 */
const ACCOUNTS_ENRICHED_EXPECTED_COLUMNS = [
  "account_id",
  "account_name",
  "account_type",
  "account_subtype",
  "active",
  "current_balance",
];

async function loadAccounts(slug: EntitySlug): Promise<BankAccount[]> {
  try {
    const rows = await driveLoadCsv(`entities/${slug}/accounts_enriched.csv`);
    warnMissingColumns(
      rows,
      ACCOUNTS_ENRICHED_EXPECTED_COLUMNS,
      `accounts_enriched.csv for ${slug}`,
    );
    return rows
      .filter((row) => (row["account_type"] ?? "").trim() === "Bank")
      .map((row) => {
        const name = row["account_name"] ?? "";
        return {
          id: row["account_id"] ?? "",
          name,
          institution: parseInstitution(name),
          account_type: row["account_subtype"] || row["account_type"] || "",
          last_four: parseLastFour(name),
          balance: toNumber(row["current_balance"]),
          color: "",
          reconciled: toBoolean(row["active"]),
          last_reconciled: "",
        };
      });
  } catch (err) {
    console.warn(`[transformBanking] failed to load accounts_enriched.csv for ${slug}:`, err);
    return [];
  }
}

/**
 * bill_lines.csv is AP bill line-item detail, used here as a stand-in for
 * recent transaction activity: entity,bill_id,line_num,vendor_id,vendor_name,
 * bill_date,due_date,bill_total,bill_balance,ap_account,detail_type,account_id,
 * account_name,product_service_id,product_service_name,customer_id,
 * customer_name,description,line_amount,memo
 */
const BILL_LINES_EXPECTED_COLUMNS = [
  "bill_id",
  "line_num",
  "account_id",
  "bill_date",
  "line_amount",
  "bill_balance",
];

async function loadTransactions(slug: EntitySlug): Promise<BankTransaction[]> {
  try {
    const rows = await driveLoadCsv(`entities/${slug}/bill_lines.csv`);
    warnMissingColumns(rows, BILL_LINES_EXPECTED_COLUMNS, `bill_lines.csv for ${slug}`);
    return rows.map((row) => {
      const billBalance = toNumber(row["bill_balance"]);
      const description =
        row["description"] || row["memo"] || row["product_service_name"] || row["vendor_name"] || "";
      return {
        id: `${row["bill_id"] ?? ""}-${row["line_num"] ?? ""}`,
        account_id: row["account_id"] ?? "",
        date: row["bill_date"] ?? "",
        description,
        amount: toNumber(row["line_amount"]),
        category: row["account_name"] ?? "",
        reconciled: billBalance === 0,
      };
    });
  } catch (err) {
    console.warn(`[transformBanking] failed to load bill_lines.csv for ${slug}:`, err);
    return [];
  }
}

export async function transformBanking(slug: EntitySlug, asOf: string): Promise<BankingData> {
  const [accounts, transactions] = await Promise.all([
    loadAccounts(slug),
    loadTransactions(slug),
  ]);

  const total_cash = accounts.reduce((sum, account) => sum + account.balance, 0);
  const unreconciled_count = accounts.filter((account) => !account.reconciled).length;
  const reconciliation_status: BankingData["reconciliation_status"] =
    unreconciled_count === 0 ? "clean" : unreconciled_count > 2 ? "needs_review" : "pending";

  return {
    entity_slug: slug,
    as_of: asOf,
    total_cash,
    reconciliation_status,
    unreconciled_count,
    accounts,
    transactions,
  };
}
