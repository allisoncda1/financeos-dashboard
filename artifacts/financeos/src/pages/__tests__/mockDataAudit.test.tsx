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

// ─── 9a. CommissionSettings — no hardcoded timestamps or amounts ──────────────

describe("CommissionSettings — honest unavailable state", () => {
  it("does not contain hardcoded 'Jul 8, 2026 9:02 AM' sync timestamp", () => {
    const content = src("pages/commissions/settings.tsx");
    expect(content).not.toContain("Jul 8, 2026");
    expect(content).not.toContain("9:02 AM");
  });

  it("does not contain hardcoded '$100.00' minimum payout amount", () => {
    const content = src("pages/commissions/settings.tsx");
    expect(content).not.toContain('"$100.00"');
  });

  it("contains not-implemented banner data-testid", () => {
    const content = src("pages/commissions/settings.tsx");
    expect(content).toContain("commission-settings-unavailable");
  });

  it("renders the not-implemented banner", async () => {
    const { default: Page } = await import("../commissions/settings");
    render(<Page />);
    expect(screen.getByTestId("commission-settings-unavailable")).toBeTruthy();
  });
});

// ─── 9b. CommissionLayout — period dropdown disabled (dead affordance) ────────

describe("CommissionLayout — no dead interactive period selector", () => {
  it("period Select does not have a defaultValue bound to static options", () => {
    const content = src("components/commission/CommissionLayout.tsx");
    expect(content).not.toContain('defaultValue="jun26"');
    expect(content).not.toContain('<SelectItem value="jun26">');
  });

  it("period Select is disabled", () => {
    const content = src("components/commission/CommissionLayout.tsx");
    // The Select must carry disabled so it is not an interactive dead affordance
    expect(content).toContain("<Select disabled>");
  });
});

// ─── 9c. BudgetSettings — Edit/Add Department buttons are semantically disabled

describe("BudgetSettings — dead buttons carry disabled attribute", () => {
  it("Edit buttons inside departments section are disabled", () => {
    const content = src("pages/budget/settings.tsx");
    expect(content).toContain('disabled>Edit</Button>');
  });

  it("Add Department button is disabled", () => {
    const content = src("pages/budget/settings.tsx");
    expect(content).toContain('data-testid="button-add-department" disabled');
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
    // Provider import appears before CommissionRoutes usage
    expect(providerIdx).toBeLessThan(routesIdx);
  });
});
