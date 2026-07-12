import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../db", () => ({
  FinancialPeriodsService: {
    getMonthlyPeriods: vi.fn(),
    getYtdPeriod: vi.fn(),
  },
}));
vi.mock("../../db/snapshots", () => ({ getCurrentSnapshot: vi.fn() }));
vi.mock("../../services/entityCache", () => ({ getCachedEntityId: vi.fn() }));

import { FinancialPeriodsService } from "../../db";
import { getCurrentSnapshot } from "../../db/snapshots";
import { getCachedEntityId } from "../../services/entityCache";
import { transformFinancialsNeon } from "../financialsNeon";

const ytd = {
  periodStart: "2026-01-01", periodEnd: "2026-07-11",
  revenue: 100, cogs: 20, grossProfit: 80, opex: 30, netIncome: 50,
  totalAssets: 200, totalLiabilities: 120, totalEquity: 80,
  cashOnHand: 40, accountsReceivable: 30, accountsPayable: 10,
};

function snapshot(details: object) {
  return { financials: { balance_sheet: details } };
}

describe("transformFinancialsNeon RC-002", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getCachedEntityId).mockResolvedValue("entity-id");
    vi.mocked(FinancialPeriodsService.getMonthlyPeriods).mockResolvedValue([] as never);
    vi.mocked(FinancialPeriodsService.getYtdPeriod).mockResolvedValue(ytd as never);
  });

  it("reads all four detail fields from the semantic snapshot", async () => {
    vi.mocked(getCurrentSnapshot).mockResolvedValue(snapshot({
      assets: { prepaid_expenses: 5 },
      liabilities: { accrued_liabilities: 15, deferred_revenue: 20 },
      equity: { paid_in_capital: 25 },
    }) as never);
    const result = await transformFinancialsNeon("T3_Marketing", "2026-07-11");
    expect(result.balance_sheet.assets.prepaid_expenses).toBe(5);
    expect(result.balance_sheet.liabilities.accrued_liabilities).toBe(15);
    expect(result.balance_sheet.liabilities.deferred_revenue).toBe(20);
    expect(result.balance_sheet.equity.paid_in_capital).toBe(25);
    expect(result.balance_sheet.equity.retained_earnings).toBe(55);
  });

  it("preserves negative QBO report values", async () => {
    vi.mocked(getCurrentSnapshot).mockResolvedValue(snapshot({
      assets: { prepaid_expenses: 0 },
      liabilities: { accrued_liabilities: 0, deferred_revenue: -500 },
      equity: { paid_in_capital: 0 },
    }) as never);
    const result = await transformFinancialsNeon("T3_Marketing", "2026-07-11");
    expect(result.balance_sheet.liabilities.deferred_revenue).toBe(-500);
  });

  it("accepts legitimate zero values", async () => {
    vi.mocked(getCurrentSnapshot).mockResolvedValue(snapshot({
      assets: { prepaid_expenses: 0 },
      liabilities: { accrued_liabilities: 0, deferred_revenue: 0 },
      equity: { paid_in_capital: 0 },
    }) as never);
    const result = await transformFinancialsNeon("CarDealer_ai", "2026-07-11");
    expect(result.balance_sheet.assets.prepaid_expenses).toBe(0);
  });

  it("rejects a missing semantic detail object instead of inventing zeros", async () => {
    vi.mocked(getCurrentSnapshot).mockResolvedValue({ financials: {} } as never);
    await expect(transformFinancialsNeon("CarDealer_ai", "2026-07-11"))
      .rejects.toThrow("no Balance Sheet detail");
  });

  it("rejects malformed detail values", async () => {
    vi.mocked(getCurrentSnapshot).mockResolvedValue(snapshot({
      assets: { prepaid_expenses: "bad" },
      liabilities: { accrued_liabilities: 0, deferred_revenue: 0 },
      equity: { paid_in_capital: 0 },
    }) as never);
    await expect(transformFinancialsNeon("CarDealer_ai", "2026-07-11"))
      .rejects.toThrow("Invalid prepaid_expenses");
  });
});
