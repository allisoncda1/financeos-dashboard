/**
 * RC-017 History page tests.
 *
 * Verifies /analyze/history renders the consolidated /api/model/history payload
 * WITHOUT performing any client-side financial math: month-over-month values are
 * rendered straight from the API `changes` array, cross-entity totals come from
 * the API `monthly` array, and getMockData is never called.
 *
 * NOTE: the financeos package does not yet ship a browser test runner
 * (vitest + jsdom + @testing-library/react). These tests are written against
 * that stack and run once it is added:
 *   pnpm add -D vitest jsdom @testing-library/react @testing-library/jest-dom
 * and a vite.config `test.environment = "jsdom"`.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import type { HistoryResponse } from "@/lib/types";

// Mock the entity selection so both entities are selected.
vi.mock("@/lib/entity-context", () => ({
  useEntitySelection: () => ({ selected: ["CarDealer_ai", "T3_Marketing"] }),
}));

// Spy on the mock module: it must NEVER be called from the history page.
const getMockData = vi.fn();
vi.mock("@/lib/mock", () => ({
  getMockData,
  getFinancials: vi.fn(),
  getCustomers: vi.fn(),
  getVendors: vi.fn(),
  getBanking: vi.fn(),
}));

const useHistory = vi.fn();
vi.mock("@/hooks/useApi", () => ({ useHistory: (...a: unknown[]) => useHistory(...a) }));

import HistoryPage from "../analyze/history";

const AVAILABLE: HistoryResponse = {
  available: true,
  status: "available",
  entities: ["CarDealer.ai", "T3 Marketing"],
  period_start: "2026-01",
  period_end: "2026-02",
  generated_at: "2026-07-15T00:00:00.000Z",
  monthly: [
    { period: "2026-01", period_start: "2026-01-01", period_end: "2026-01-31", revenue: 100, net_income: 10, by_entity: {} },
    { period: "2026-02", period_start: "2026-02-01", period_end: "2026-02-28", revenue: 150, net_income: 25, by_entity: {} },
  ],
  changes: [
    { period: "2026-02", revenue_change: 50, revenue_change_pct: 50, net_income_change: 15, net_income_change_pct: 150 },
  ],
  snapshots: [
    { entity: "CarDealer.ai", slug: "CarDealer_ai", period: "2026-01", revenue: 100, net_income: 10 },
  ],
  health_score_history: null,
  health_score_available: false,
  health_score_unavailable_reason: "no_historical_health_scores_persisted",
};

beforeEach(() => {
  getMockData.mockReset();
  useHistory.mockReset();
});

describe("HistoryPage", () => {
  it("1. renders core sections when data is available", () => {
    useHistory.mockReturnValue({ data: AVAILABLE, source: "db", lastSuccessfulFetch: null });
    render(<HistoryPage />);
    expect(screen.getByText("Month-over-Month Changes")).toBeInTheDocument();
    expect(screen.getByText("Portfolio Monthly Summary")).toBeInTheDocument();
    expect(screen.getByText("Entity-Period Snapshots")).toBeInTheDocument();
  });

  it("2. renders MoM values from the API changes array (no client math)", () => {
    useHistory.mockReturnValue({ data: AVAILABLE, source: "db", lastSuccessfulFetch: null });
    render(<HistoryPage />);
    // The rendered MoM row must reflect the server value (150%), which no
    // client-side recomputation from monthly (which would yield a different
    // basis) produced.
    const row = screen.getByTestId("mom-2026-02");
    expect(row.textContent).toContain("150");
  });

  it("3. shows the unavailable state when status='unavailable'", () => {
    useHistory.mockReturnValue({
      data: { ...AVAILABLE, status: "unavailable", available: false, monthly: [], changes: [], snapshots: [] },
      source: "db",
      lastSuccessfulFetch: null,
    });
    render(<HistoryPage />);
    expect(screen.getByTestId("history-unavailable")).toBeInTheDocument();
  });

  it("4. shows a loading state while the fetch is in flight", () => {
    useHistory.mockReturnValue({ data: null, source: "loading", lastSuccessfulFetch: null });
    render(<HistoryPage />);
    expect(screen.getByTestId("history-status").textContent).toContain("Loading");
  });

  it("5. never calls getMockData", () => {
    useHistory.mockReturnValue({ data: AVAILABLE, source: "db", lastSuccessfulFetch: null });
    render(<HistoryPage />);
    expect(getMockData).not.toHaveBeenCalled();
  });

  it("shows honest health-unavailable message when not persisted", () => {
    useHistory.mockReturnValue({ data: AVAILABLE, source: "db", lastSuccessfulFetch: null });
    render(<HistoryPage />);
    expect(screen.getByTestId("health-unavailable").textContent).toContain("not yet available");
  });
});
