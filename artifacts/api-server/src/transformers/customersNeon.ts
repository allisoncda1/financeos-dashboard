import { InvoicesService, FinancialPeriodsService } from "../db";
import { getCurrentSnapshot } from "../db/snapshots";
import { getCachedEntityId } from "../services/entityCache";
import { AGING_BUCKET_ORDER } from "../services/aging";
import type { EntitySlug, CustomersData, Customer, AgingBucket } from "../lib/types";

/**
 * Canonical bucket keys from the Python semantic layer → display label map.
 * Must match AGING_BUCKET_ORDER so the array is always in the expected order.
 */
const SNAPSHOT_BUCKET_KEYS: Record<string, string> = {
  current:      "Current",
  days_1_30:    "1-30",
  days_31_60:   "31-60",
  days_61_90:   "61-90",
  days_91_plus: "90+",
};

/**
 * Build authoritative AgingBucket[] from the ar_aging_buckets map stored in
 * the entity snapshot. Preserves the canonical bucket order and returns a
 * count of 0 for empty buckets (count is not stored in the snapshot — it is
 * available only from invoice records).
 */
function buildAgingFromSnapshot(
  arAgingBuckets: Record<string, number>,
): AgingBucket[] {
  return AGING_BUCKET_ORDER.map((label) => {
    // Find the snapshot key whose display label matches this position.
    const snapshotKey = Object.keys(SNAPSHOT_BUCKET_KEYS).find(
      (k) => SNAPSHOT_BUCKET_KEYS[k] === label,
    );
    const amount = snapshotKey != null ? (arAgingBuckets[snapshotKey] ?? 0) : 0;
    return { label, days: label, amount, count: 0 };
  });
}

export async function transformCustomersNeon(slug: EntitySlug, asOf: string): Promise<CustomersData> {
  const entityId = await getCachedEntityId(slug);
  if (!entityId) throw new Error(`Entity not found in Neon: ${slug}`);

  const year = new Date(asOf).getFullYear();

  // Fetch snapshot, invoice detail, and DSO history in parallel.
  const [snapshot, topCustomers, monthlyPeriods] = await Promise.all([
    getCurrentSnapshot(entityId),
    InvoicesService.getTopCustomersByAr(entityId),
    FinancialPeriodsService.getMonthlyPeriods(entityId, year),
  ]);

  // ── Authoritative AR metrics from Python semantic layer ───────────────────
  // The entity snapshot carries ar_ap_metrics populated by the Python
  // build_semantic_layer pipeline from the QBO AgedReceivableSummary report.
  // This is the single source of truth for open_ar, ar_overdue, ar_overdue_pct,
  // and the aging bucket amounts.
  //
  // Invoice records are used only for customer-level detail rows (names, due
  // dates, individual balances) and the DSO trend history. Their subtotal
  // must NOT be used to override or independently reconstruct the official AR.
  const arApMetrics = (snapshot?.metrics as Record<string, unknown> | null)
    ?.ar_ap_metrics as Record<string, unknown> | undefined;

  let open_ar:      number;
  let ar_overdue:   number;
  let ar_overdue_pct: number;
  let aging:        AgingBucket[];
  let aging_source: "snapshot" | "invoices";

  if (arApMetrics) {
    open_ar        = Number(arApMetrics.open_ar        ?? 0);
    ar_overdue     = Number(arApMetrics.ar_overdue     ?? 0);
    ar_overdue_pct = Number(arApMetrics.ar_overdue_pct ?? 0);
    aging          = buildAgingFromSnapshot(
      (arApMetrics.ar_aging_buckets as Record<string, number>) ?? {},
    );
    aging_source   = "snapshot";
  } else {
    // Fallback: snapshot unavailable (entity not yet published by pipeline).
    // Use invoice-derived values and flag the source explicitly so callers
    // know the totals are approximate.
    const openInvoices = await InvoicesService.getOpenInvoices(entityId);
    open_ar        = openInvoices.reduce((sum, inv) => sum + inv.balance, 0);
    ar_overdue     = openInvoices
      .filter((inv) => (inv.daysOverdue ?? 0) > 0)
      .reduce((sum, inv) => sum + inv.balance, 0);
    ar_overdue_pct = open_ar > 0 ? (ar_overdue / open_ar) * 100 : 0;
    aging          = await InvoicesService.getArAgingBuckets(entityId);
    aging_source   = "invoices";
  }

  const top_customers: Customer[] = topCustomers.map((c) => ({
    name:              c.name,
    balance:           c.balance,
    last_payment_date: "",
    dso_days:          c.dsodays,
    status:            c.status,
  }));

  const dso_history = monthlyPeriods.map((r) => r.dsoDays);

  return {
    entity_slug: slug,
    as_of:       asOf,
    open_ar,
    ar_overdue,
    ar_overdue_pct,
    aging,
    aging_source,
    top_customers,
    dso_history,
  };
}
