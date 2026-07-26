/**
 * Global entity / data architecture alignment tests.
 *
 * Verifies that:
 *   1.  Analytics pages show the ANALYTICS_DATA_LABEL demo banner in AnalyticsLayout.
 *   2.  Analytics Settings "Save Settings" button is disabled (no backend persistence).
 *   3.  Analytics Cost Centers "Add Cost Center" button is disabled (no backend action).
 *   4.  Portfolio entity count is dynamic (ENTITY_SLUGS.length), not hardcoded "4".
 *   5.  AccountingSidebar SidebarCompanyCard receives the active accounting entity slug.
 *   6.  No mock data imports in live Accounting pages (grep-level assertion).
 *   7.  Accounting pages that have live hooks do not fall back to fake data.
 *   8.  Budget stub pages remain honest (no table data, show not-available notices).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { ENTITY_SLUGS } from "@/lib/entities";
import { ANALYTICS_DATA_LABEL } from "@/lib/analyticsDemoData";

// ─── Analytics context ─────────────────────────────────────────────────────────

vi.mock("@/lib/analytics-context", () => ({
  useAnalyticsFilters: () => ({
    entity: "consolidated",
    setEntity: vi.fn(),
    period: "fy26",
    setPeriod: vi.fn(),
    basis: "accrual",
    setBasis: vi.fn(),
    scenario: "approved-allocation",
    setScenario: vi.fn(),
  }),
}));

// ─── Accounting context ────────────────────────────────────────────────────────

let accountingSlug = "CarDealer_ai";
vi.mock("@/lib/accounting-context", () => ({
  useAccountingEntity: () => ({ activeSlug: accountingSlug, setActiveSlug: vi.fn() }),
  AccountingEntityProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// ─── Auth ──────────────────────────────────────────────────────────────────────

vi.mock("@/lib/auth", () => ({
  useAuth: () => ({ user: { name: "Test", email: "test@test.com" }, logout: vi.fn() }),
}));

// ─── useApi hooks ─────────────────────────────────────────────────────────────

vi.mock("@/hooks/useApi", () => ({
  useDashboardData: () => ({ data: null, source: "unavailable" as const }),
  useBriefing: () => ({ data: null, source: "unavailable" as const }),
  usePipelineStatus: () => ({ data: null, source: "unavailable" as const }),
  useAccountingAccounts: () => ({ data: null, source: "unavailable" as const }),
}));

// ─── Layout / router / UI mocks ────────────────────────────────────────────────

vi.mock("@/components/layout/GlobalHeader", () => ({
  GlobalHeader: () => <div data-testid="global-header" />,
}));
vi.mock("@/components/analytics/AnalyticsSidebar", () => ({
  AnalyticsSidebar: () => <div />,
}));
vi.mock("@/components/shared/CompanySelectItems", () => ({
  CompanySelectItems: () => null,
}));
vi.mock("@/components/shared/SidebarCompanyCard", () => ({
  SidebarCompanyCard: ({ slug, label }: { slug?: string; label?: string }) => (
    <div data-testid="sidebar-company-card" data-slug={slug} data-label={label} />
  ),
}));
vi.mock("@/components/ui/EntityLogo", () => ({
  EntityLogo: () => <div />,
}));
vi.mock("@/components/ui/FinanceOSLogo", () => ({
  FinanceOSLogo: () => <div />,
}));
vi.mock("@/components/ui/button", () => ({
  Button: ({ children, disabled, "data-testid": testId, title, ...rest }: {
    children?: React.ReactNode; disabled?: boolean; "data-testid"?: string; title?: string; [k: string]: unknown;
  }) => <button disabled={disabled} data-testid={testId} title={title}>{children}</button>,
}));
vi.mock("@/components/ui/select", () => ({
  Select: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectTrigger: ({ children, "data-testid": testId }: { children?: React.ReactNode; "data-testid"?: string }) =>
    <button data-testid={testId}>{children}</button>,
  SelectValue: ({ placeholder }: { placeholder?: string }) => <span>{placeholder}</span>,
  SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("@/components/analytics/AnalyticsKpiCard", () => ({
  AnalyticsKpiCard: () => null,
}));
vi.mock("framer-motion", () => {
  const El = (tag: string) => ({ children, layoutId, initial, animate, exit, transition, ...rest }: {
    children?: React.ReactNode; layoutId?: string; initial?: unknown; animate?: unknown; exit?: unknown; transition?: unknown; [k: string]: unknown;
  }) => React.createElement(tag, rest, children);
  return {
    motion: { div: El("div"), span: El("span") },
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  };
});
vi.mock("@/lib/next-compat", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
  usePathname: () => "/accounting",
}));
vi.mock("@/lib/format", () => ({ formatCurrency: (v: number) => `$${v}` }));

import React from "react";

// ─── 1. AnalyticsLayout renders the demo data banner ─────────────────────────

describe("AnalyticsLayout — demo data label", () => {
  it("1. renders ANALYTICS_DATA_LABEL on every analytics page (cost-centers as representative)", async () => {
    const { default: CostCentersPage } = await import("../analytics/cost-centers");
    render(<CostCentersPage />);
    expect(screen.getByText(ANALYTICS_DATA_LABEL)).toBeTruthy();
  });

  it("2. renders ANALYTICS_DATA_LABEL on analytics settings page", async () => {
    const { default: AnalyticsSettingsPage } = await import("../analytics/settings");
    render(<AnalyticsSettingsPage />);
    expect(screen.getByText(ANALYTICS_DATA_LABEL)).toBeTruthy();
  });
});

// ─── 2. Analytics Settings — Save button is disabled ─────────────────────────

describe("Analytics Settings — Save button disabled", () => {
  it("3. Save Settings button is disabled (no backend persistence)", async () => {
    const { default: AnalyticsSettingsPage } = await import("../analytics/settings");
    render(<AnalyticsSettingsPage />);
    const btn = screen.getByTestId("button-save-settings");
    expect(btn).toBeDisabled();
  });

  it("4. shows 'Demo — settings not persisted' notice", async () => {
    const { default: AnalyticsSettingsPage } = await import("../analytics/settings");
    render(<AnalyticsSettingsPage />);
    expect(screen.getByTestId("analytics-settings-not-persisted")).toBeTruthy();
  });
});

// ─── 3. Analytics Cost Centers — Add button is disabled ──────────────────────

describe("Analytics Cost Centers — Add Cost Center disabled", () => {
  it("5. Add Cost Center button is disabled", async () => {
    const { default: CostCentersPage } = await import("../analytics/cost-centers");
    render(<CostCentersPage />);
    const btn = screen.getByTestId("button-add-cost-center");
    expect(btn).toBeDisabled();
  });
});

// ─── 4. Portfolio — entity count is dynamic ───────────────────────────────────

describe("Portfolio — entity count derived from ENTITY_SLUGS", () => {
  it("6. portfolio.tsx source does not contain the literal string '4 entities'", async () => {
    const { readFileSync } = await import("fs");
    const { resolve } = await import("path");
    const src = readFileSync(resolve(import.meta.dirname, "../portfolio.tsx"), "utf-8");
    // The hardcoded literal must be gone — it should be replaced with ENTITY_SLUGS.length
    expect(src).not.toContain('"4 entities"');
    expect(src).not.toContain("4 entities ·");
    expect(src).toContain("ENTITY_SLUGS.length");
  });
});

// ─── 5. AccountingSidebar — SidebarCompanyCard receives active slug ───────────

describe("AccountingSidebar — SidebarCompanyCard wired to active entity", () => {
  beforeEach(() => { accountingSlug = "CarDealer_ai"; });

  it("7. SidebarCompanyCard receives CarDealer_ai slug when that entity is active", async () => {
    const { AccountingSidebar } = await import("../../components/accounting/AccountingSidebar");
    render(<AccountingSidebar />);
    const card = screen.getByTestId("sidebar-company-card");
    expect(card.dataset.slug).toBe("CarDealer_ai");
  });

  it("8. SidebarCompanyCard slug updates when active entity changes", async () => {
    accountingSlug = "T3_Marketing";
    const { AccountingSidebar } = await import("../../components/accounting/AccountingSidebar");
    render(<AccountingSidebar />);
    const card = screen.getByTestId("sidebar-company-card");
    expect(card.dataset.slug).toBe("T3_Marketing");
    expect(card.dataset.slug).not.toBe("T3_Marketing" === "T3_Marketing" ? "CarDealer_ai" : "T3_Marketing");
  });

  it("9. SidebarCompanyCard slug is never the hardcoded default 'T3_Marketing' when a different entity is active", async () => {
    accountingSlug = "Kairox_Coaching";
    const { AccountingSidebar } = await import("../../components/accounting/AccountingSidebar");
    render(<AccountingSidebar />);
    const card = screen.getByTestId("sidebar-company-card");
    expect(card.dataset.slug).toBe("Kairox_Coaching");
    expect(card.dataset.slug).not.toBe("T3_Marketing");
  });
});

// ─── 6. No mock data imports in live Accounting pages ────────────────────────

describe("Source code — no mock/demo data imports in live accounting pages", () => {
  const LIVE_ACCOUNTING_PAGES = [
    "accounting/workspace",
    "accounting/invoices",
    "accounting/transactions",
    "accounting/reconciliation",
    "accounting/customers",
    "accounting/vendors",
    "accounting/chart-of-accounts",
    "accounting/banking",
  ] as const;

  it("10. no analyticsDemoData or getMockData import in live accounting pages", async () => {
    for (const page of LIVE_ACCOUNTING_PAGES) {
      const { readFileSync } = await import("fs");
      const { resolve } = await import("path");
      const filePath = resolve(
        import.meta.dirname,
        "..",
        `${page}.tsx`,
      );
      const source = readFileSync(filePath, "utf-8");
      expect(source, `${page} must not import analyticsDemoData`).not.toMatch(/analyticsDemoData/);
      expect(source, `${page} must not import getMockData`).not.toMatch(/getMockData/);
    }
  });
});

// ─── 7. Budget stub pages are honest ─────────────────────────────────────────

vi.mock("@/components/budget/BudgetLayout", () => ({
  BudgetLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

describe("Budget stub pages — honest not-implemented notices", () => {
  it("11. Budget Assumptions shows not-implemented notice, no table", async () => {
    const { default: AssumptionsPage } = await import("../budget/assumptions");
    render(<AssumptionsPage />);
    // "not yet implemented" appears in the page's body text (within a paragraph)
    expect(screen.getByText(/not yet implemented/i)).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("12. Budget Balance Sheet shows coming-soon / not-available notice", async () => {
    const { default: BalanceSheetPage } = await import("../budget/balance-sheet");
    render(<BalanceSheetPage />);
    // "coming soon" appears in the h3 heading — unique enough to target directly
    expect(screen.getByText(/coming soon/i)).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
  });
});
