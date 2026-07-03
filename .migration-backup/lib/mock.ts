// Mock data loader — Phase 1 only.
//
// PHASE 2 SWAP: Replace getMockData() with getDriveData() which calls
// the /api/model Next.js API route. The DashboardData shape is identical —
// no component changes required, only this file changes.
//
// NEVER import drive.ts (Phase 2) in client components.
// NEVER import real financial data here.

import type { DashboardData, CustomersData, VendorsData, FinancialsData, BankingData } from "./types";
import type { EntitySlug } from "./types";

import portfolioSummary   from "@/data/mock/portfolio/summary.json";
import validationSummary  from "@/data/mock/validation/validation_summary.json";
import dataFreshness      from "@/data/mock/audit/data_freshness.json";

import carDealerMetrics   from "@/data/mock/entities/CarDealer_ai/metrics.json";
import t3Metrics          from "@/data/mock/entities/T3_Marketing/metrics.json";
import topMrktrMetrics    from "@/data/mock/entities/TopMrktr/metrics.json";
import smileMoreMetrics   from "@/data/mock/entities/Smile_More/metrics.json";

import carDealerAnomalies from "@/data/mock/entities/CarDealer_ai/anomalies.json";
import t3Anomalies        from "@/data/mock/entities/T3_Marketing/anomalies.json";
import topMrktrAnomalies  from "@/data/mock/entities/TopMrktr/anomalies.json";
import smileMoreAnomalies from "@/data/mock/entities/Smile_More/anomalies.json";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const cast = <T>(v: unknown): T => v as T;

export function getMockData(): DashboardData {
  return {
    portfolio:  cast(portfolioSummary),
    validation: cast(validationSummary),
    freshness:  cast(dataFreshness),
    metrics: {
      CarDealer_ai: cast(carDealerMetrics),
      T3_Marketing: cast(t3Metrics),
      TopMrktr:     cast(topMrktrMetrics),
      Smile_More:   cast(smileMoreMetrics),
    },
    anomalies: {
      CarDealer_ai: cast(carDealerAnomalies),
      T3_Marketing: cast(t3Anomalies),
      TopMrktr:     cast(topMrktrAnomalies),
      Smile_More:   cast(smileMoreAnomalies),
    },
  };
}

// ─── Sprint 2: Entity sub-page loaders ───────────────────────────────────────

import carDealerFinancials from "@/data/mock/entities/CarDealer_ai/financials.json";
import t3Financials        from "@/data/mock/entities/T3_Marketing/financials.json";
import topMrktrFinancials  from "@/data/mock/entities/TopMrktr/financials.json";
import smileMoreFinancials from "@/data/mock/entities/Smile_More/financials.json";

import carDealerCustomers  from "@/data/mock/entities/CarDealer_ai/customers.json";
import t3Customers         from "@/data/mock/entities/T3_Marketing/customers.json";
import topMrktrCustomers   from "@/data/mock/entities/TopMrktr/customers.json";
import smileMoreCustomers  from "@/data/mock/entities/Smile_More/customers.json";

import carDealerVendors    from "@/data/mock/entities/CarDealer_ai/vendors.json";
import t3Vendors           from "@/data/mock/entities/T3_Marketing/vendors.json";
import topMrktrVendors     from "@/data/mock/entities/TopMrktr/vendors.json";
import smileMoreVendors    from "@/data/mock/entities/Smile_More/vendors.json";

import carDealerBanking    from "@/data/mock/entities/CarDealer_ai/banking.json";
import t3Banking           from "@/data/mock/entities/T3_Marketing/banking.json";
import topMrktrBanking     from "@/data/mock/entities/TopMrktr/banking.json";
import smileMoreBanking    from "@/data/mock/entities/Smile_More/banking.json";

const financialsMap: Record<EntitySlug, unknown> = {
  CarDealer_ai: carDealerFinancials,
  T3_Marketing: t3Financials,
  TopMrktr:     topMrktrFinancials,
  Smile_More:   smileMoreFinancials,
};
const customersMap: Record<EntitySlug, unknown> = {
  CarDealer_ai: carDealerCustomers,
  T3_Marketing: t3Customers,
  TopMrktr:     topMrktrCustomers,
  Smile_More:   smileMoreCustomers,
};
const vendorsMap: Record<EntitySlug, unknown> = {
  CarDealer_ai: carDealerVendors,
  T3_Marketing: t3Vendors,
  TopMrktr:     topMrktrVendors,
  Smile_More:   smileMoreVendors,
};
const bankingMap: Record<EntitySlug, unknown> = {
  CarDealer_ai: carDealerBanking,
  T3_Marketing: t3Banking,
  TopMrktr:     topMrktrBanking,
  Smile_More:   smileMoreBanking,
};

export function getFinancials(slug: EntitySlug): FinancialsData { return cast(financialsMap[slug]); }
export function getCustomers(slug: EntitySlug): CustomersData   { return cast(customersMap[slug]); }
export function getVendors(slug: EntitySlug): VendorsData       { return cast(vendorsMap[slug]); }
export function getBanking(slug: EntitySlug): BankingData       { return cast(bankingMap[slug]); }

// ─── Phase 2 stub (not yet implemented) ──────────────────────────────────────
// export async function getDriveData(): Promise<DashboardData> {
//   const res = await fetch("/api/model");
//   if (!res.ok) throw new Error("Drive data fetch failed");
//   return res.json();
// }
