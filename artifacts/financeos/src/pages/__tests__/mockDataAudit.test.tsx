/**
 * Mock data isolation audit.
 *
 * Verifies that no production pages or components import the named mock data
 * modules, that the hardcoded sync timestamp is gone from AccountingLayout,
 * and that commission and budget stub pages show honest not-implemented states
 * instead of fabricated data.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { readFileSync } from "fs";
import { resolve } from "path";

// ─── helpers ─────────────────────────────────────────────────────────────────

const SRC = resolve(import.meta.dirname, "..", "..");

function src(relPath: string): string {
  return readFileSync(resolve(SRC, relPath), "utf-8");
}

const PRODUCTION_PAGES = [
  "pages/accounting/workspace.tsx",
  "pages/accounting/banking.tsx",
  "pages/accounting/customers.tsx",
  "pages/accounting/vendors.tsx",
  "pages/accounting/transactions/index.tsx",
  "pages/accounting/chart-of-accounts.tsx",
  "pages/accounting/reconciliation/index.tsx",
  "pages/commissions/overview.tsx",
  "pages/commissions/calculations.tsx",
  "pages/commissions/clients.tsx",
  "pages/commissions/invoices.tsx",
  "pages/commissions/payouts.tsx",
  "pages/commissions/plans.tsx",
  "pages/commissions/reports.tsx",
  "pages/commissions/sales-reps.tsx",
  "pages/budget/index.tsx",
  "pages/budget/builder.tsx",
  "pages/budget/pnl.tsx",
  "pages/budget/budget-vs-actual.tsx",
];

const PRODUCTION_COMPONENTS = [
  "components/accounting/AccountingLayout.tsx",
  "components/budget/BudgetCategoryChart.tsx",
  "components/budget/BudgetDetailTable.tsx",
  "components/budget/BudgetTable.tsx",
  "components/budget/BudgetVsPriorYearChart.tsx",
  "components/budget/RecentActivityCard.tsx",
  "components/commission/CommissionKPICards.tsx",
  "components/commission/CommissionPlanCard.tsx",
  "components/commission/CommissionRepChart.tsx",
  "components/commission/CommissionStatusTable.tsx",
  "components/commission/CommissionTrendChart.tsx",
  "components/commission/UpcomingPayoutCard.tsx",
];

const ALL_PRODUCTION = [...PRODUCTION_PAGES, ...PRODUCTION_COMPONENTS];

// ─── 1. No mock data imports in production files ──────────────────────────────

describe("Mock data isolation — production files must not import named mock modules", () => {
  const FORBIDDEN = [
    "budgetMockData",
    "budgetModuleMockData",
    "commissionMockData",
    "accountingMockData",
  ];

  for (const file of ALL_PRODUCTION) {
    it(`${file} — no forbidden mock import`, () => {
      let content: string;
      try {
        content = src(file);
      } catch {
        return; // file does not exist — not a regression
      }
      for (const token of FORBIDDEN) {
        expect(content, `${file} must not import ${token}`).not.toContain(token);
      }
    });
  }
});

// ─── 2. AccountingLayout — no hardcoded sync timestamp ───────────────────────

describe("AccountingLayout — sync timestamp", () => {
  it("does not contain the hardcoded 'Last sync 9:02 AM' string", () => {
    const content = src("components/accounting/AccountingLayout.tsx");
    expect(content).not.toContain("Last sync 9:02");
    expect(content).not.toContain("9:02 AM");
  });

  it("does not contain CheckCircle2 import (replaced by honest state)", () => {
    const content = src("components/accounting/AccountingLayout.tsx");
    expect(content).not.toContain("CheckCircle2");
  });

  it("contains 'Sync status unavailable' honest notice", () => {
    const content = src("components/accounting/AccountingLayout.tsx");
    expect(content).toContain("Sync status unavailable");
  });

  it("entity select is wired to useAccountingEntity", () => {
    const content = src("components/accounting/AccountingLayout.tsx");
    expect(content).toContain("useAccountingEntity");
    expect(content).toContain("setActiveSlug");
  });
});

// ─── 3. Commission pages render honest not-implemented notices ────────────────

vi.mock("@/components/commission/CommissionLayout", () => ({
  CommissionLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("@/components/commission/CommissionSidebar", () => ({
  CommissionSidebar: () => null,
}));
vi.mock("@/components/layout/GlobalHeader", () => ({
  GlobalHeader: () => null,
}));

describe("Commission pages — honest not-implemented states", () => {
  const COMMISSION_PAGES: Array<[string, string]> = [
    ["calculations", "commission-calculations-unavailable"],
    ["clients", "commission-clients-unavailable"],
    ["plans", "commission-plans-unavailable"],
    ["reports", "commission-reports-unavailable"],
    ["sales-reps", "commission-sales-reps-unavailable"],
  ];

  for (const [page, testId] of COMMISSION_PAGES) {
    it(`commissions/${page} shows not-implemented notice`, async () => {
      const { default: Page } = await import(`../commissions/${page}`);
      render(<Page />);
      expect(screen.getByTestId(testId)).toBeTruthy();
    });
  }

  it("commissions/invoices delegates to CommissionStatusTable (which is itself a stub)", async () => {
    const { default: Page } = await import("../commissions/invoices");
    render(<Page />);
    expect(screen.getByTestId("commission-status-table-unavailable")).toBeTruthy();
  });

  it("commissions/payouts shows payout stub and upcoming payout stub", async () => {
    const { default: Page } = await import("../commissions/payouts");
    render(<Page />);
    expect(screen.getByTestId("commission-payouts-unavailable")).toBeTruthy();
    expect(screen.getByTestId("commission-upcoming-payout-unavailable")).toBeTruthy();
  });
});

// ─── 4. Commission components render honest stubs ─────────────────────────────

describe("Commission components — honest stubs, no mock data", () => {
  const COMPONENT_TEST_IDS: Array<[string, string]> = [
    ["CommissionKPICards", "commission-kpi-unavailable"],
    ["CommissionPlanCard", "commission-plan-card-unavailable"],
    ["CommissionRepChart", "commission-rep-chart-unavailable"],
    ["CommissionStatusTable", "commission-status-table-unavailable"],
    ["CommissionTrendChart", "commission-trend-chart-unavailable"],
    ["UpcomingPayoutCard", "commission-upcoming-payout-unavailable"],
  ];

  for (const [name, testId] of COMPONENT_TEST_IDS) {
    it(`${name} renders honest unavailable notice`, async () => {
      const mod = await import(`../../components/commission/${name}`);
      const Component = mod[name];
      render(<Component />);
      expect(screen.getByTestId(testId)).toBeTruthy();
    });
  }
});

// ─── 5. Budget components render honest stubs ─────────────────────────────────

describe("Budget components — honest stubs, no mock data", () => {
  const BUDGET_COMPONENTS: Array<[string, string]> = [
    ["BudgetCategoryChart", "budget-category-chart-unavailable"],
    ["BudgetTable", "budget-table-unavailable"],
    ["BudgetVsPriorYearChart", "budget-vs-prior-year-unavailable"],
    ["RecentActivityCard", "budget-recent-activity-unavailable"],
  ];

  for (const [name, testId] of BUDGET_COMPONENTS) {
    it(`${name} renders honest unavailable notice`, async () => {
      const mod = await import(`../../components/budget/${name}`);
      const Component = mod[name];
      render(<Component />);
      expect(screen.getByTestId(testId)).toBeTruthy();
    });
  }

  it("BudgetDetailTable renders honest unavailable notice", async () => {
    const { BudgetDetailTable } = await import("../../components/budget/BudgetDetailTable");
    render(<BudgetDetailTable title="Revenue" />);
    expect(screen.getByTestId("budget-detail-table-unavailable")).toBeTruthy();
  });
});

// ─── 6. Null safety — workspace renders dashes for null values ────────────────

vi.mock("@/components/accounting/AccountingLayout", () => ({
  AccountingLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("@/lib/accounting-context", () => ({
  useAccountingEntity: () => ({ activeSlug: "CarDealer_ai", setActiveSlug: vi.fn() }),
  AccountingEntityProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("@/hooks/useApi", () => ({
  useAccountingAccounts: () => ({ data: null }),
  useAccountingTransactions: () => ({ data: null }),
  useAccountingInvoices: () => ({ data: null }),
  useDashboardData: () => ({ data: null, source: "unavailable" }),
  useBriefing: () => ({ data: null }),
  usePipelineStatus: () => ({ data: null }),
}));
vi.mock("wouter", () => ({
  Link: ({ children, href }: { children: React.ReactNode; href: string }) =>
    <a href={href}>{children}</a>,
}));
vi.mock("@/lib/format", () => ({ formatCurrency: (v: number) => `$${v}` }));

describe("Accounting workspace — null safety (no silent zero substitution)", () => {
  it("shows dash for null totalTx, unreconciled, and overdue AR", async () => {
    const { default: WorkspacePage } = await import("../accounting/workspace");
    render(<WorkspacePage />);
    const dashes = screen.getAllByText("—");
    // All three KPI cards show — when data is null
    expect(dashes.length).toBeGreaterThanOrEqual(3);
  });

  it("does not render '0' for any KPI when data is null", async () => {
    const { default: WorkspacePage } = await import("../accounting/workspace");
    render(<WorkspacePage />);
    // No KPI card should show a bare zero value
    const zeros = screen.queryAllByText("0");
    expect(zeros.length).toBe(0);
  });
});

// ─── 7. CommissionLayout — entity selector wired, Calculate button disabled ───

vi.mock("@/lib/commission-context", () => {
  let slug = "CarDealer_ai";
  const setActiveSlug = (s: string) => { slug = s; };
  return {
    useCommissionEntity: () => ({ activeSlug: slug, setActiveSlug }),
    CommissionEntityProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  };
});
vi.mock("@/components/commission/CommissionSidebar", () => ({
  CommissionSidebar: () => null,
}));
vi.mock("@/components/shared/CompanySelectItems", () => ({
  CompanySelectItems: () => null,
}));

describe("CommissionLayout — entity context wired, no dead affordances", () => {
  it("source does not contain defaultValue='all' entity selector", () => {
    const content = src("components/commission/CommissionLayout.tsx");
    // The old dead defaultValue="all" must be gone
    expect(content).not.toContain('defaultValue="all"');
  });

  it("source imports useCommissionEntity (not a dead static dropdown)", () => {
    const content = src("components/commission/CommissionLayout.tsx");
    expect(content).toContain("useCommissionEntity");
    expect(content).toContain("setActiveSlug");
  });

  it("Calculate Commissions button is disabled", () => {
    const content = src("components/commission/CommissionLayout.tsx");
    // The button must carry a disabled attribute
    expect(content).toContain("disabled");
    expect(content).toContain("Calculate Commissions");
  });
});

// ─── 8. CommissionSidebar — SidebarCompanyCard wired to active entity ─────────

describe("CommissionSidebar — no hardcoded default entity", () => {
  it("source passes activeSlug to SidebarCompanyCard", () => {
    const content = src("components/commission/CommissionSidebar.tsx");
    expect(content).toContain("useCommissionEntity");
    expect(content).toContain("activeSlug");
    // The bare <SidebarCompanyCard /> with no slug must be gone
    expect(content).not.toMatch(/<SidebarCompanyCard\s*\/>/);
  });
});

// ─── 9. App.tsx — CommissionEntityProvider wraps commission routes ─────────────

describe("App.tsx — CommissionEntityProvider in provider tree", () => {
  it("imports CommissionEntityProvider", () => {
    const content = src("App.tsx");
    expect(content).toContain("CommissionEntityProvider");
  });

  it("CommissionEntityProvider wraps CommissionRoutes", () => {
    const content = src("App.tsx");
    const providerIdx = content.indexOf("CommissionEntityProvider");
    const routesIdx   = content.indexOf("CommissionRoutes");
    expect(providerIdx).toBeGreaterThan(-1);
    expect(routesIdx).toBeGreaterThan(-1);
    expect(providerIdx).toBeLessThan(routesIdx);
  });
});

// ─── 10. Commission settings — no hardcoded stale values ─────────────────────

describe("CommissionSettings — honest unavailable state", () => {
  it("does not contain hardcoded stale sync timestamp", () => {
    const content = src("pages/commissions/settings.tsx");
    expect(content).not.toContain("Jul 8, 2026");
    expect(content).not.toContain("9:02 AM");
  });

  it('does not contain hardcoded "$100.00" minimum payout', () => {
    const content = src("pages/commissions/settings.tsx");
    expect(content).not.toContain('"$100.00"');
  });

  it("contains commission-settings-unavailable data-testid", () => {
    const content = src("pages/commissions/settings.tsx");
    expect(content).toContain("commission-settings-unavailable");
  });

  it("renders the not-implemented banner", async () => {
    const { default: Page } = await import("../commissions/settings");
    render(<Page />);
    expect(screen.getByTestId("commission-settings-unavailable")).toBeTruthy();
  });
});

// ─── 11. CommissionLayout — dead period dropdown disabled ─────────────────────

describe("CommissionLayout — no dead interactive period selector", () => {
  it('period Select does not have a static defaultValue="jun26"', () => {
    const content = src("components/commission/CommissionLayout.tsx");
    expect(content).not.toContain('defaultValue="jun26"');
    expect(content).not.toContain('<SelectItem value="jun26">');
  });

  it("period Select carries disabled attribute", () => {
    const content = src("components/commission/CommissionLayout.tsx");
    expect(content).toContain("<Select disabled>");
  });
});

// ─── 12. BudgetSettings — dead buttons are semantically disabled ──────────────

describe("BudgetSettings — dead buttons carry disabled attribute", () => {
  it("Edit buttons in departments list are disabled", () => {
    const content = src("pages/budget/settings.tsx");
    expect(content).toContain('disabled>Edit</Button>');
  });

  it("Add Department button is disabled", () => {
    const content = src("pages/budget/settings.tsx");
    expect(content).toContain('data-testid="button-add-department" disabled');
  });
});

// ─── 13. Forecast module — no forecastMockData in production files ────────────

const FORECAST_PRODUCTION_FILES = [
  "components/forecast/ForecastKpiCard.tsx",
  "components/forecast/ForecastVsBudgetChart.tsx",
  "components/forecast/ForecastSummaryTable.tsx",
  "components/forecast/ForecastDriversTable.tsx",
  "components/forecast/CashFlowForecastChart.tsx",
  "components/forecast/ForecastAiInsightCard.tsx",
  "pages/forecast/overview.tsx",
  "pages/forecast/revenue.tsx",
  "pages/forecast/pnl.tsx",
  "pages/forecast/cash-flow.tsx",
  "pages/forecast/balance-sheet.tsx",
  "pages/forecast/scenarios.tsx",
  "pages/forecast/drivers.tsx",
  "pages/forecast/reports.tsx",
  "pages/forecast/settings.tsx",
];

describe("Forecast module — no forecastMockData imports in production", () => {
  for (const file of FORECAST_PRODUCTION_FILES) {
    it(`${file} — no forecastMockData import`, () => {
      let content: string;
      try { content = src(file); } catch { return; }
      expect(content).not.toContain("forecastMockData");
    });
  }
});

// ─── 14. Forecast module — no hardcoded sync timestamp ───────────────────────

describe("Forecast module — no hardcoded stale timestamps", () => {
  it("ForecastLayout does not contain 'Today at 9:02 AM'", () => {
    const content = src("components/forecast/ForecastLayout.tsx");
    expect(content).not.toContain("9:02 AM");
    expect(content).not.toContain("Today at");
  });

  it('ForecastLayout entity selector is disabled (not defaultValue="all")', () => {
    const content = src("components/forecast/ForecastLayout.tsx");
    expect(content).not.toContain('defaultValue="all"');
  });

  it('ForecastLayout fiscal year selector is disabled (not defaultValue="fy26")', () => {
    const content = src("components/forecast/ForecastLayout.tsx");
    expect(content).not.toContain('defaultValue="fy26"');
  });

  it("ForecastLayout Update Forecast button is disabled", () => {
    const content = src("components/forecast/ForecastLayout.tsx");
    expect(content).toContain('disabled');
    expect(content).toContain('Update Forecast');
  });

  it("forecast/settings.tsx does not contain 'Today at 9:02 AM'", () => {
    const content = src("pages/forecast/settings.tsx");
    expect(content).not.toContain("9:02 AM");
    expect(content).not.toContain("Today at");
  });

  it("forecast/settings.tsx contains not-implemented banner", () => {
    const content = src("pages/forecast/settings.tsx");
    expect(content).toContain("forecast-settings-unavailable");
  });
});

// ─── 15. Forecast components — honest stubs with data-testids ────────────────

vi.mock("@/components/forecast/ForecastLayout", () => ({
  ForecastLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("@/components/forecast/ForecastSidebar", () => ({
  ForecastSidebar: () => null,
}));

describe("Forecast components — honest unavailable stubs", () => {
  const FORECAST_COMPONENT_STUBS: Array<[string, string, string]> = [
    ["ForecastKpiCard", "ForecastKpiCards", "forecast-kpi-unavailable"],
    ["ForecastVsBudgetChart", "ForecastVsBudgetChart", "forecast-vs-budget-unavailable"],
    ["ForecastSummaryTable", "ForecastSummaryTable", "forecast-summary-unavailable"],
    ["ForecastDriversTable", "ForecastDriversTable", "forecast-drivers-unavailable"],
    ["CashFlowForecastChart", "CashFlowForecastChart", "forecast-cashflow-unavailable"],
    ["ForecastAiInsightCard", "ForecastAiInsightCard", "forecast-ai-insight-unavailable"],
  ];

  for (const [file, exportName, testId] of FORECAST_COMPONENT_STUBS) {
    it(`${file} renders honest unavailable notice`, async () => {
      const mod = await import(`../../components/forecast/${file}`);
      const Component = mod[exportName] as React.FC;
      render(<Component />);
      expect(screen.getByTestId(testId)).toBeTruthy();
    });
  }
});

describe("Forecast pages — honest unavailable stubs", () => {
  const FORECAST_PAGE_STUBS: Array<[string, string]> = [
    ["balance-sheet", "forecast-balance-sheet-unavailable"],
    ["pnl", "forecast-pnl-unavailable"],
    ["reports", "forecast-reports-unavailable"],
    ["scenarios", "forecast-scenarios-unavailable"],
    ["revenue", "forecast-revenue-unavailable"],
    ["cash-flow", "forecast-cashflow-page-unavailable"],
    ["drivers", "forecast-drivers-page-unavailable"],
    ["settings", "forecast-settings-unavailable"],
  ];

  for (const [page, testId] of FORECAST_PAGE_STUBS) {
    it(`forecast/${page} shows not-implemented notice`, async () => {
      const { default: Page } = await import(`../forecast/${page}`);
      render(<Page />);
      expect(screen.getByTestId(testId)).toBeTruthy();
    });
  }
});

// ─── 16. Plaid routes — entity ownership source guards ───────────────────────

describe("Plaid routes — entity ownership source audit", () => {
  const PLAID_ROUTE_FILE = resolve(
    import.meta.dirname,
    "../../../../api-server/src/routes/plaid.ts",
  );

  function plaidSrc(): string {
    return readFileSync(PLAID_ROUTE_FILE, "utf-8");
  }

  it("sync route handler contains entity ownership check before calling sync", () => {
    const content = plaidSrc();
    // Isolate just the sync route handler section
    const routeStart = content.indexOf('"/plaid/items/:id/sync"');
    const routeEnd   = content.indexOf('"/plaid/accounts"');
    expect(routeStart).toBeGreaterThan(-1);
    expect(routeEnd).toBeGreaterThan(routeStart);
    const syncRouteSegment = content.slice(routeStart, routeEnd);
    // Ownership check must be present in this handler
    expect(syncRouteSegment).toContain("plaid_item_id = $1 AND entity_slug = $2");
    // The sync call must also be in this handler
    expect(syncRouteSegment).toContain("syncTransactionsForItem(plaidItemId)");
    // Ownership check must appear before the sync call within the handler
    const ownershipIdx = syncRouteSegment.indexOf("plaid_item_id = $1 AND entity_slug = $2");
    const syncCallIdx  = syncRouteSegment.indexOf("syncTransactionsForItem(plaidItemId)");
    expect(ownershipIdx).toBeLessThan(syncCallIdx);
  });

  it("disconnect route verifies entity_slug ownership before updating plaid_items", () => {
    const content = plaidSrc();
    expect(content).toContain("itemEntitySlug !== entitySlug");
    expect(content).toContain("Connection does not belong to the specified entity");
  });

  it("disconnect route requires entitySlug from request body", () => {
    const content = plaidSrc();
    expect(content).toContain('entitySlug required and must be a valid entity');
  });

  it("sync route requires entitySlug from request", () => {
    const content = plaidSrc();
    // Check that validateEntitySlug is called in the sync handler
    const syncHandlerStart = content.indexOf("/plaid/items/:id/sync");
    const nextHandlerStart = content.indexOf("/plaid/accounts");
    const segment = content.slice(syncHandlerStart, nextHandlerStart);
    expect(segment).toContain("validateEntitySlug");
  });
});
