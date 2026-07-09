import { EntitiesService, BillsService } from "../db";
import type { EntitySlug, VendorsData, Vendor, AgingBucket } from "../lib/types";

export async function transformVendorsNeon(slug: EntitySlug, asOf: string): Promise<VendorsData> {
  const entityId = await EntitiesService.getEntityIdBySlug(slug);
  if (!entityId) throw new Error(`Entity not found in Neon: ${slug}`);

  const [aging, topVendors, openBills] = await Promise.all([
    BillsService.getApAgingBuckets(entityId),
    BillsService.getTopVendorsByAp(entityId),
    BillsService.getOpenBills(entityId),
  ]);

  const open_ap = openBills.reduce((sum, bill) => sum + bill.balance, 0);

  const top_vendors: Vendor[] = topVendors.map((v) => ({
    name:     v.name,
    balance:  v.balance,
    due_date: v.dueDate ?? "",
    status:   v.status,
  }));

  return {
    entity_slug: slug,
    as_of:       asOf,
    open_ap,
    aging:       aging as AgingBucket[],
    top_vendors,
    ap_history:  [],             // historical AP series not in Neon
  };
}
