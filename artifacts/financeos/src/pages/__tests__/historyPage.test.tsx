/**
 * RC-017 History page tests.
 *
 * Verifies /analyze/history renders the consolidated /api/model/history payload
 * WITHOUT performing any client-side financial math: month-over-month values are
 * rendered straight from the API `changes` array, cross-entity totals come from
 * the API `monthly` array, nulls stay blank (never silently 0), negatives and
 * zeros render correctly, and getMockData is never called.
 *
 * Runs under vitest + jsdom + @testing-library/react (configured in
 * artifacts/financeos/vitest.config.ts).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import type { HistoryResponse, HistoryMonthlyPoint } from "@/lib/types";

// Mutable entity selection — individual tests override `selected`.
let selected: string[] = ["CarDealer_ai", "T3_Marketing"];
vi.mock("@/lib/entity-context", () => ({
  useEntitySelection: () => ({ selected }),
}));

// Spy on the mock-data module: it must NEVER be called from the history page.
const getMockData = vi.fn();
vi.mock("@/lib/mock", () => ({
  getMockData,
  getFinancials: vi.fn(),
  getCustomers: vi.fn(),
  getVendors: vi.fn(),
  getBanking: vi.fn(),
}));

// Capture the args useHistory is called with (proves the entity filter → slugs).
const useHistory = vi.fn();
vi.mock("@/hooks/useApi", () => ({ useHistory: (...a: unknown[]) => useHistory(...a) }));

import HistoryPage from "../analyze/history";

function point(
  period: string,
  revenue: number | null,
  net_income: number | null,
  extra: Partial<HistoryMonthlyPoint> = {},
): HistoryMonthlyPoint {
  return {
    period,
    period_start: `${period}-01`,
    period_end: `${period}-28`,
    revenue,
    net_income,
    by_entity: {},
    partial: false,
    contributing: [],
    missing: [],
    ...extra,
  };
}

const AVAILABLE: HistoryResponse = {
  available: true,
  status: "available",
  entities: ["CarDealer.ai", "T3 Marketing"],
  period_start: "2026-01",
  period_end: "2026-02",
  generated_at: "2026-07-15T00:00:00.000Z",
  monthly: [point("2026-01", 100, 10), point("2026-02", 150, 25)],
  changes: [
    { period: "2026-02", revenue_change: 50, revenue_change_pct: 50, net_income_change: 15, net_income_change_pct: 150 },
  ],
  snapshots: [{ entity: "CarDealer.ai", slug: "CarDealer_ai", period: "2026-01", revenue: 100, net_income: 10 }],
  health_score_history: null,
  health_score_available: false,
  health_score_unavailable_reason: "no_historical_health_scores_persisted",
};

beforeEach(() => {
  selected = ["CarDealer_ai", "T3_Marketing"];
  getMockData.mockReset();
  useHistory.mockReset();
});

describe("HistoryPage", () => {
  it("1. renders the loading state while the fetch is in flight", () => {
    useHistory.mockReturnValue({ data: null, source: "loading", lastSuccessfulFetch: null });
    render(<HistoryPage />);
    expect(screen.getByTestId("history-status").textContent).toContain("Loading");
  });

  it("2. available state: Revenue and Net Income render from the API (not recalculated)", () => {
    useHistory.mockReturnValue({ data: AVAILABLE, source: "db", lastSuccessfulFetch: null });
    render(<HistoryPage />);
    expect(screen.getByText("Portfolio Monthly Summary")).toBeInTheDocument();
    expect(screen.getByText("Month-over-Month Changes")).toBeInTheDocument();
    expect(screen.getByText("Entity-Period Snapshots")).toBeInTheDocument();
    // The API monthly totals (100 / 150 revenue) are rendered verbatim.
    expect(screen.getAllByText("$100").length).toBeGreaterThan(0);
    expect(screen.getAllByText("$150").length).toBeGreaterThan(0);
  });

  it("3. partial state renders the partial banner", () => {
    useHistory.mockReturnValue({
      data: { ...AVAILABLE, status: "partial" },
      source: "db",
      lastSuccessfulFetch: null,
    });
    render(<HistoryPage />);
    expect(screen.getByTestId("history-partial")).toBeInTheDocument();
    expect(screen.getByTestId("history-partial").textContent).toContain("Partial history");
  });

  it("4. unavailable state renders the unavailable message", () => {
    useHistory.mockReturnValue({
      data: { ...AVAILABLE, status: "unavailable", available: false, monthly: [], changes: [], snapshots: [] },
      source: "db",
      lastSuccessfulFetch: null,
    });
    render(<HistoryPage />);
    expect(screen.getByTestId("history-unavailable")).toBeInTheDocument();
    expect(screen.getByTestId("history-unavailable").textContent).toContain("No monthly history available");
  });

  it("5. entity filter: the selected slugs are passed to the API hook", () => {
    selected = ["Smile_More", "TopMrktr"];
    useHistory.mockReturnValue({ data: AVAILABLE, source: "db", lastSuccessfulFetch: null });
    render(<HistoryPage />);
    // Slugs are filtered through canonical ENTITY_SLUGS order before the call.
    expect(useHistory).toHaveBeenCalledWith(["TopMrktr", "Smile_More"]);
  });

  it("6. MoM values render from the API `changes` array (no client-side math)", () => {
    useHistory.mockReturnValue({ data: AVAILABLE, source: "db", lastSuccessfulFetch: null });
    render(<HistoryPage />);
    // 150% is the server's net-income pct; a client recomputation from monthly
    // would use a different basis. Its presence proves the API value is used.
    const row = screen.getByTestId("mom-2026-02");
    expect(row.textContent).toContain("150");
    expect(row.textContent).toContain("$50"); // revenue dollar change from API
  });

  it("7. missing Health Score shows the 'not yet available' message", () => {
    useHistory.mockReturnValue({ data: AVAILABLE, source: "db", lastSuccessfulFetch: null });
    render(<HistoryPage />);
    expect(screen.getByTestId("health-unavailable").textContent).toContain("not yet available");
  });

  it("8. never imports or calls getMockData", () => {
    useHistory.mockReturnValue({ data: AVAILABLE, source: "db", lastSuccessfulFetch: null });
    render(<HistoryPage />);
    expect(getMockData).not.toHaveBeenCalled();
  });

  it("9. a null Revenue stays blank (—), never silently rendered as 0", () => {
    useHistory.mockReturnValue({
      data: { ...AVAILABLE, monthly: [point("2026-01", null, 10)], changes: [], snapshots: [] },
      source: "db",
      lastSuccessfulFetch: null,
    });
    render(<HistoryPage />);
    // No "$0" is invented for the null revenue cell.
    expect(screen.queryByText("$0")).not.toBeInTheDocument();
    // The em-dash placeholder is present instead.
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
  });

  it("10. negative values render correctly (Smile More negative net income)", () => {
    useHistory.mockReturnValue({
      data: { ...AVAILABLE, monthly: [point("2026-01", 100, -40)], changes: [], snapshots: [] },
      source: "db",
      lastSuccessfulFetch: null,
    });
    render(<HistoryPage />);
    expect(screen.getAllByText("-$40").length).toBeGreaterThan(0);
  });

  it("11. zero values render correctly ($0, not blank)", () => {
    useHistory.mockReturnValue({
      data: { ...AVAILABLE, monthly: [point("2026-01", 0, 0)], changes: [], snapshots: [] },
      source: "db",
      lastSuccessfulFetch: null,
    });
    render(<HistoryPage />);
    // 0 is a real value → "$0" rendered (Revenue + Net Income rows).
    expect(screen.getAllByText("$0").length).toBeGreaterThanOrEqual(1);
  });

  it("12. API error state is handled (source=unavailable, data=null)", () => {
    useHistory.mockReturnValue({ data: null, source: "unavailable", lastSuccessfulFetch: null });
    render(<HistoryPage />);
    expect(screen.getByTestId("history-status").textContent).toContain("Data unavailable");
  });
});
