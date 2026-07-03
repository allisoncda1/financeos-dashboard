import { driveLoadCsv } from "../lib/driveLoader";
import type { EntitySlug, CustomersData, AgingBucket, Customer } from "../lib/types";

function toNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed === "") return 0;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
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

async function loadArAgingRows(slug: EntitySlug): Promise<ArAgingRow[]> {
  try {
    const rows = await driveLoadCsv(`entities/${slug}/ar_aging.csv`);
    return rows.map((row) => ({
      customerName: row["customer_name"] ?? "",
      balance: toNumber(row["balance"]),
      daysOverdue: toNumber(row["days_overdue"]),
      bucket: row["aging_bucket"] ?? "",
    }));
  } catch (err) {
    console.warn(`[transformCustomers] failed to load ar_aging.csv for ${slug}:`, err);
    return [];
  }
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

async function loadTopCustomers(slug: EntitySlug, agingRows: ArAgingRow[]): Promise<Customer[]> {
  const maxOverdueByCustomer = new Map<string, number>();
  for (const row of agingRows) {
    const existing = maxOverdueByCustomer.get(row.customerName) ?? 0;
    maxOverdueByCustomer.set(row.customerName, Math.max(existing, row.daysOverdue));
  }

  try {
    const rows = await driveLoadCsv(`entities/${slug}/customers_enriched.csv`);
    return rows
      .map((row) => {
        const name = row["customer_name"] ?? "";
        const balance = toNumber(row["balance"]);
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

  const open_ar = aging.reduce((sum, bucket) => sum + bucket.amount, 0);

  return {
    entity_slug: slug,
    as_of: asOf,
    open_ar,
    aging,
    top_customers,
    dso_history: [],
  };
}
