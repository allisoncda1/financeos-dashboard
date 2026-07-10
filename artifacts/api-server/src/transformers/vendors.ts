import { driveLoadCsv } from "../lib/driveLoader";
import type { EntitySlug, VendorsData, AgingBucket, Vendor } from "../lib/types";
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
      `[transformVendors] ${source} is missing expected column(s): ${missing.join(", ")}. Found: ${Array.from(actualColumns).join(", ")}`,
    );
  }
}

/**
 * ap_aging.csv is bill-level (one row per open bill), not pre-aggregated:
 * entity,vendor_name,bill_date,due_date,balance,days_overdue,aging_bucket,txn_type
 * Aging buckets are derived by grouping rows by aging_bucket (e.g. "1-30", "31-60").
 *
 * Note: for entities with no open bills (verified against real Drive data,
 * e.g. CarDealer_ai), this file legitimately has zero data rows. That is not
 * a column-mapping bug -- it should resolve to a clean empty state, which
 * the try/catch + map over an empty array already produces.
 */
type ApAgingRow = {
  vendorName: string;
  balance: number;
  daysOverdue: number;
  bucket: string;
  dueDate: string;
};

const AP_AGING_EXPECTED_COLUMNS = ["vendor_name", "balance", "days_overdue", "aging_bucket", "due_date"];

async function loadApAgingRows(slug: EntitySlug): Promise<ApAgingRow[]> {
  try {
    const rows = await driveLoadCsv(`entities/${slug}/ap_aging.csv`);
    warnMissingColumns(rows, AP_AGING_EXPECTED_COLUMNS, `ap_aging.csv for ${slug}`);
    return rows.map((row) => ({
      vendorName: row["vendor_name"] ?? "",
      balance: parseNumeric(row["balance"]),
      daysOverdue: parseNumeric(row["days_overdue"]),
      bucket: row["aging_bucket"] ?? "",
      dueDate: row["due_date"] ?? "",
    }));
  } catch (err) {
    console.warn(`[transformVendors] failed to load ap_aging.csv for ${slug}:`, err);
    return [];
  }
}

function buildAgingBuckets(rows: ApAgingRow[]): AgingBucket[] {
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

function toVendorStatus(maxDaysOverdue: number): Vendor["status"] {
  if (maxDaysOverdue > 0) return "overdue";
  return "current";
}

const TOP_VENDORS_LIMIT = 10;
const VENDORS_ENRICHED_EXPECTED_COLUMNS = ["vendor_name", "balance"];

async function loadTopVendors(slug: EntitySlug, agingRows: ApAgingRow[]): Promise<Vendor[]> {
  const infoByVendor = new Map<string, { maxDaysOverdue: number; dueDate: string }>();
  for (const row of agingRows) {
    const existing = infoByVendor.get(row.vendorName) ?? { maxDaysOverdue: 0, dueDate: "" };
    infoByVendor.set(row.vendorName, {
      maxDaysOverdue: Math.max(existing.maxDaysOverdue, row.daysOverdue),
      dueDate: existing.dueDate || row.dueDate,
    });
  }

  try {
    const rows = await driveLoadCsv(`entities/${slug}/vendors_enriched.csv`);
    warnMissingColumns(rows, VENDORS_ENRICHED_EXPECTED_COLUMNS, `vendors_enriched.csv for ${slug}`);
    return rows
      .map((row) => {
        const name = row["vendor_name"] ?? "";
        const balance = parseNumeric(row["balance"]);
        const info = infoByVendor.get(name) ?? { maxDaysOverdue: 0, dueDate: "" };
        return {
          name,
          balance,
          due_date: info.dueDate,
          status: toVendorStatus(info.maxDaysOverdue),
        };
      })
      .filter((vendor) => vendor.balance !== 0)
      .sort((a, b) => b.balance - a.balance)
      .slice(0, TOP_VENDORS_LIMIT);
  } catch (err) {
    console.warn(`[transformVendors] failed to load vendors_enriched.csv for ${slug}:`, err);
    return [];
  }
}

export async function transformVendors(slug: EntitySlug, asOf: string): Promise<VendorsData> {
  const agingRows = await loadApAgingRows(slug);
  const aging = buildAgingBuckets(agingRows);
  const top_vendors = await loadTopVendors(slug, agingRows);

  const open_ap = aging.reduce((sum, bucket) => sum + bucket.amount, 0);

  return {
    entity_slug: slug,
    as_of: asOf,
    open_ap,
    aging,
    top_vendors,
    ap_history: [],
  };
}
