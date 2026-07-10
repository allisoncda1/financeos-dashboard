import { InvoicesService, FinancialPeriodsService } from "../db";
import { getCachedEntityId } from "../services/entityCache";
import type { EntitySlug, CustomersData, Customer, AgingBucket } from "../lib/types";

export async function transformCustomersNeon(slug: EntitySlug, asOf: string): Promise<CustomersData> {
  const entityId = await getCachedEntityId(slug);
  if (!entityId) throw new Error(`Entity not found in Neon: ${slug}`);

  const year = new Date(asOf).getFullYear();
  const [aging, topCustomers, openInvoices, monthlyPeriods] = await Promise.all([
    InvoicesService.getArAgingBuckets(entityId),
    InvoicesService.getTopCustomersByAr(entityId),
    InvoicesService.getOpenInvoices(entityId),
    FinancialPeriodsService.getMonthlyPeriods(entityId, year),
  ]);

  const open_ar = openInvoices.reduce((sum, inv) => sum + inv.balance, 0);

  const top_customers: Customer[] = topCustomers.map((c) => ({
    name:              c.name,
    balance:           c.balance,
    last_payment_date: "",       // not stored in Neon invoices table
    dso_days:          c.dsodays,
    status:            c.status,
  }));

  // DSO trend: monthly dso_days values from financial_periods, oldest first
  const dso_history = monthlyPeriods.map((r) => r.dsoDays);

  return {
    entity_slug:   slug,
    as_of:         asOf,
    open_ar,
    aging,
    top_customers,
    dso_history,
  };
}
