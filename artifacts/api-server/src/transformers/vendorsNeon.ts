import { EntitiesService, BillsService, FinancialPeriodsService } from "../db";
import type { EntitySlug, VendorsData, Vendor, AgingBucket } from "../lib/types";

export async function transformVendorsNeon(slug: EntitySlug, asOf: string): Promise<VendorsData> {
  const entityId = await EntitiesService.getEntityIdBySlug(slug);
  if (!entityId) throw new Error(`Entity not found in Neon: ${slug}`);

  const year = new Date(asOf).getFullYear();
  const [aging, topVendors, openBills, monthlyPeriods] = await Promise.all([
    BillsService.getApAgingBuckets(entityId),
    BillsService.getTopVendorsByAp(entityId),
    BillsService.getOpenBills(entityId),
    FinancialPeriodsService.getMonthlyPeriods(entityId, year),
  ]);

  const open_ap = openBills.reduce((sum, bill) => sum + bill.balance, 0);

  const top_vendors: Vendor[] = topVendors.map((v) => ({
    name:     v.name,
    balance:  v.balance,
    due_date: v.dueDate ?? "",
    status:   v.status,
  }));

  // AP trend: monthly open_ap values from financial_periods, oldest first
  const ap_history = monthlyPeriods.map((r) => r.openAp);

  return {
    entity_slug: slug,
    as_of:       asOf,
    open_ap,
    aging:       aging as AgingBucket[],
    top_vendors,
    ap_history,
  };
}
