// Mock data loader — Phase 1 only.
//
// PHASE 2 SWAP: Replace getMockData() with getDriveData() which calls
// the /api/model Next.js API route. The DashboardData shape is identical —
// no component changes required, only this file changes.
//
// NEVER import drive.ts (Phase 2) in client components.
// NEVER import real financial data here.

import type { DashboardData } from "./types";

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

// ─── Phase 2 stub (not yet implemented) ──────────────────────────────────────
// export async function getDriveData(): Promise<DashboardData> {
//   const res = await fetch("/api/model");
//   if (!res.ok) throw new Error("Drive data fetch failed");
//   return res.json();
// }
