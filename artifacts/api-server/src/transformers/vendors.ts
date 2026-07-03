import { driveLoadCsv } from "../lib/driveLoader";
import type { EntitySlug, VendorsData, AgingBucket, Vendor } from "../lib/types";

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
 * ap_aging.csv is bill-level (one row per open bill), not pre-aggregated:
 * entity,vendor_name,bill_date,due_date,balance,days_overdue,aging_bucket,txn_type
 * Aging buckets are derived by grouping rows by aging_bucket (e.g. "1-30", "31-60").
 */
type ApAgingRow = {
  vendorName: string;
  balance: number;
  daysOverdue: number;
  bucket: string;
  dueDate: string;
};

async function loadApAgingRows(slug: EntitySlug): Promise<ApAgingRow[]> {
  try {
    const rows = await driveLoadCsv(`entities/${slug}/ap_aging.csv`);
    return rows.map((row) => ({
      vendorName: row["vendor_name"] ?? "",
      balance: toNumber(row["balance"]),
      daysOverdue: toNumber(row["days_overdue"]),
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
    return rows
      .map((row) => {
        const name = row["vendor_name"] ?? "";
        const balance = toNumber(row["balance"]);
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
