import { driveLoadCsv } from "../lib/driveLoader";
import type { EntitySlug, CustomersData, AgingBucket, Customer } from "../lib/types";
import { parseNumeric } from "../services/numerics";

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
      `[transformCustomers] ${source} is missing expected column(s): ${missing.join(", ")}. Found: ${Array.from(actualColumns).join(", ")}`,
    );
  }
}

/**
 * ar_aging.csv is invoice-level (one row per open invoice), not pre-aggregated:
 * entity,customer_name,invoice_number,invoice_date,due_date,balance,days_overdue,aging_bucket,txn_type
 * Aging buckets are derived by grouping rows by aging_bucket (e.g. "1-30", "31-60").
 */
type ArAgingRow = {
  customerName: string;
  balance: number;
  daysOverdue: number;
  bucket: string;
};

const AR_AGING_EXPECTED_COLUMNS = [
  "customer_name",
  "balance",
  "days_overdue",
  "aging_bucket",
];

async function loadArAgingRows(slug: EntitySlug): Promise<ArAgingRow[]> {
  try {
    const rows = await driveLoadCsv(`entities/${slug}/ar_aging.csv`);
    warnMissingColumns(rows, AR_AGING_EXPECTED_COLUMNS, `ar_aging.csv for ${slug}`);
    return rows.map((row) => ({
      customerName: row["customer_name"] ?? "",
      balance: parseNumeric(row["balance"]),
      daysOverdue: parseNumeric(row["days_overdue"]),
      bucket: row["aging_bucket"] ?? "",
    }));
  } catch (err) {
    console.warn(`[transformCustomers] failed to load ar_aging.csv for ${slug}:`, err);
    return [];
  }
}

/**
 * customers_enriched.csv and ar_aging.csv do not contain a pre-computed DSO
 * (days sales outstanding) figure. We approximate the entity's current DSO
 * as the balance-weighted average of days_overdue across all open invoices
 * in ar_aging.csv. Rows with a negative (credit) balance are excluded from
 * the weighting -- they represent credit memos/overpayments, not amounts a
 * customer owes, and some are years-old stale credits that would otherwise
 * skew the average to a nonsensical negative DSO. There is no historical
 * monthly snapshot data available in Drive, so dso_history is populated as
 * a flat series using this single current value (rather than fabricating a
 * fake trend) to keep the frontend sparkline and delta calculations
 * NaN-free.
 */
const DSO_HISTORY_LENGTH = 12;

function computeDsoHistory(agingRows: ArAgingRow[]): number[] {
  const debitRows = agingRows.filter((row) => row.balance > 0);
  const totalBalance = debitRows.reduce((sum, row) => sum + row.balance, 0);
  const currentDso =
    totalBalance > 0
      ? Math.round(
          debitRows.reduce((sum, row) => sum + row.balance * row.daysOverdue, 0) / totalBalance,
        )
      : 0;
  return Array(DSO_HISTORY_LENGTH).fill(currentDso);
}

function buildAgingBuckets(rows: ArAgingRow[]): AgingBucket[] {
  const buckets = new Map<string, { amount: number; count: number }>();
  for (const row of rows) {
    const key = row.bucket || "unknown";
    const existing = buckets.get(key) ?? { amount: 0, count: 0 };
    existing.amount += row.balance;
    existing.count += 1;
    buckets.set(key, existing);
  }
  return Array.from(buckets.entries()).map(([bucket, { amount, count }]) => ({
    label: bucket,
    days: bucket,
    amount,
    count,
  }));
}

function toCustomerStatus(maxDaysOverdue: number): Customer["status"] {
  if (maxDaysOverdue > 60) return "late";
  if (maxDaysOverdue > 0) return "overdue";
  return "current";
}

const TOP_CUSTOMERS_LIMIT = 10;
const CUSTOMERS_ENRICHED_EXPECTED_COLUMNS = ["customer_name", "balance"];

async function loadTopCustomers(slug: EntitySlug, agingRows: ArAgingRow[]): Promise<Customer[]> {
  const maxOverdueByCustomer = new Map<string, number>();
  for (const row of agingRows) {
    const existing = maxOverdueByCustomer.get(row.customerName) ?? 0;
    maxOverdueByCustomer.set(row.customerName, Math.max(existing, row.daysOverdue));
  }

  try {
    const rows = await driveLoadCsv(`entities/${slug}/customers_enriched.csv`);
    warnMissingColumns(
      rows,
      CUSTOMERS_ENRICHED_EXPECTED_COLUMNS,
      `customers_enriched.csv for ${slug}`,
    );
    return rows
      .map((row) => {
        const name = row["customer_name"] ?? "";
        const balance = parseNumeric(row["balance"]);
        const maxDaysOverdue = maxOverdueByCustomer.get(name) ?? 0;
        return {
          name,
          balance,
          last_payment_date: "",
          dso_days: maxDaysOverdue,
          status: toCustomerStatus(maxDaysOverdue),
        };
      })
      .filter((customer) => customer.balance !== 0)
      .sort((a, b) => b.balance - a.balance)
      .slice(0, TOP_CUSTOMERS_LIMIT);
  } catch (err) {
    console.warn(`[transformCustomers] failed to load customers_enriched.csv for ${slug}:`, err);
    return [];
  }
}

export async function transformCustomers(slug: EntitySlug, asOf: string): Promise<CustomersData> {
  const agingRows = await loadArAgingRows(slug);
  const aging = buildAgingBuckets(agingRows);
  const top_customers = await loadTopCustomers(slug, agingRows);
  const dso_history = computeDsoHistory(agingRows);

  const open_ar = aging.reduce((sum, bucket) => sum + bucket.amount, 0);

  return {
    entity_slug: slug,
    as_of: asOf,
    open_ar,
    aging,
    top_customers,
    dso_history,
  };
}
