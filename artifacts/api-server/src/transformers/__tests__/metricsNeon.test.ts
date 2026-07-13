import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../db", () => ({
  FinancialPeriodsService: { getYtdPeriod: vi.fn() },
  SyncRunsService: { getLastSuccessfulRun: vi.fn() },
}));
vi.mock("../../services/entityCache", () => ({ getCachedEntityId: vi.fn() }));

import { FinancialPeriodsService, SyncRunsService } from "../../db";
import { getCachedEntityId } from "../../services/entityCache";
import { transformMetricsNeon } from "../metricsNeon";

const period = {
  periodEnd: "2026-07-12",
  generatedAt: new Date("2026-07-12T17:17:40Z"),
  revenue: 100, cogs: 20, grossProfit: 80, grossMarginPct: 80,
  opex: 40, netIncome: 40, netMarginPct: 40,
  totalAssets: 500, totalLiabilities: 200, totalEquity: 300,
  openAr: 10, openAp: 5, dsoDays: 12, dpoDays: 8,
  cashOnHand: 50, arOverduePct: 10, apOverduePct: 0,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getCachedEntityId).mockResolvedValue("entity-1");
  vi.mocked(FinancialPeriodsService.getYtdPeriod).mockResolvedValue(period as never);
});

describe("transformMetricsNeon — RC-007 pipeline timestamp", () => {
  it("uses the completed timestamp of the latest successful incremental sync", async () => {
    vi.mocked(SyncRunsService.getLastSuccessfulRun).mockResolvedValue({
      completedAt: new Date("2026-07-12T14:43:44Z"),
    } as never);
    const result = await transformMetricsNeon("Smile_More");
    expect(result.pipeline_run).toBe("2026-07-12T14:43:44.000Z");
  });

  it("falls back to the period generation timestamp, never the current clock", async () => {
    vi.mocked(SyncRunsService.getLastSuccessfulRun).mockResolvedValue(null);
    const result = await transformMetricsNeon("Smile_More");
    expect(result.pipeline_run).toBe("2026-07-12T17:17:40.000Z");
  });

  it("still requests the current entity and year from the data services", async () => {
    vi.mocked(SyncRunsService.getLastSuccessfulRun).mockResolvedValue(null);
    await transformMetricsNeon("T3_Marketing");
    expect(SyncRunsService.getLastSuccessfulRun).toHaveBeenCalledWith("entity-1");
    expect(FinancialPeriodsService.getYtdPeriod).toHaveBeenCalledWith("entity-1", 2026);
  });
});
