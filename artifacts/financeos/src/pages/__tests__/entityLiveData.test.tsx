/**
 * Dashboard entity live-data unification tests.
 *
 * Verifies that:
 *   1. Accounting pages pass the selected entity slug to their API hooks.
 *   2. Changing entity slug triggers a refetch with the new slug (no cross-entity leakage).
 *   3. Budget pages pass the selected entity slug to their API hooks.
 *   4. Banking page scopes accounts/transactions to the selected entity slug.
 *   5. Accounting Settings "Accounting Preferences" does NOT display hardcoded values
 *      (January / Accrual / Monthly / Net 14) as live data.
 *   6. Budget Settings shows "not implemented" banners on non-persisted sections
 *      and disables the Save button.
 *   7. Static/mock data is never shown as live data on pages that have honest stubs.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

// ─── Accounting entity context mock ───────────────────────────────────────────

let accountingSlug = "CarDealer_ai";
vi.mock("@/lib/accounting-context", () => ({
  useAccountingEntity: () => ({ activeSlug: accountingSlug, setActiveSlug: vi.fn() }),
  AccountingEntityProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// ─── Budget entity context mock ───────────────────────────────────────────────

let budgetSlug = "CarDealer_ai";
vi.mock("@/lib/budget-context", () => ({
  useBudgetEntity: () => ({ activeSlug: budgetSlug, setActiveSlug: vi.fn() }),
  BudgetEntityProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// ─── useApi hook mocks — capture slugs passed, return idle state ───────────────

const capturedAccountingSlugs: Record<string, string[]> = {};

vi.mock("@/hooks/useApi", () => ({
  useAccountingAccounts: (slug: string) => {
    (capturedAccountingSlugs["accounts"] ??= []).push(slug);
    return { data: null, source: "unavailable" as const };
  },
  useAccountingTransactions: (slug: string) => {
    (capturedAccountingSlugs["transactions"] ??= []).push(slug);
    return { data: null, source: "unavailable" as const };
  },
  useAccountingInvoices: (slug: string) => {
    (capturedAccountingSlugs["invoices"] ??= []).push(slug);
    return { data: null, source: "unavailable" as const };
  },
  useAccountingCustomers: (slug: string) => {
    (capturedAccountingSlugs["customers"] ??= []).push(slug);
    return { data: null, source: "unavailable" as const };
  },
  useAccountingVendors: (slug: string) => {
    (capturedAccountingSlugs["vendors"] ??= []).push(slug);
    return { data: null, source: "unavailable" as const };
  },
  useEntityBudget: (slug: string) => {
    (capturedAccountingSlugs["entityBudget"] ??= []).push(slug);
    return { data: null, source: "unavailable" as const };
  },
  usePortfolioBudget: () => ({ data: null, source: "unavailable" as const }),
  useBudgetMutation: () => ({ save: vi.fn(), saving: false, error: null, reset: vi.fn(), refreshKey: 0 }),
  useBudgetVsActual: (slug: string) => {
    (capturedAccountingSlugs["budgetVsActual"] ??= []).push(slug);
    return { data: null, source: "unavailable" as const };
  },
}));

// ─── Layout/router mocks (prevent import cascades) ────────────────────────────

vi.mock("@/components/accounting/AccountingLayout", () => ({
  AccountingLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("@/components/accounting/AccountingUI", () => ({
  Card: ({ children, title }: { children: React.ReactNode; title?: string }) => <div data-title={title}>{children}</div>,
  DataTable: ({ children }: { children: React.ReactNode }) => <table><tbody>{children}</tbody></table>,
  Td: ({ children }: { children: React.ReactNode }) => <td>{children}</td>,
  Pill: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  MiniKpi: () => null,
}));
vi.mock("@/components/budget/BudgetLayout", () => ({
  BudgetLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("@/components/accounting/EntityPicker", () => ({
  EntityPicker: () => <div data-testid="entity-picker" />,
}));

// Shared UI primitives used by budget/settings
vi.mock("@/components/ui/label", () => ({
  Label: ({ children, className }: { children?: React.ReactNode; className?: string }) =>
    <label className={className}>{children}</label>,
}));
vi.mock("@/components/ui/select", () => ({
  Select: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <button type="button">{children}</button>,
  SelectValue: ({ placeholder }: { placeholder?: string }) => <span>{placeholder}</span>,
  SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("@/components/ui/switch", () => ({
  Switch: (props: { defaultChecked?: boolean; "data-testid"?: string }) =>
    <input type="checkbox" defaultChecked={props.defaultChecked} data-testid={props["data-testid"]} />,
}));
vi.mock("@/components/ui/input", () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}));
vi.mock("@/components/ui/button", () => ({
  Button: ({ children, disabled, "data-testid": testId, ...rest }: {
    children?: React.ReactNode; disabled?: boolean; "data-testid"?: string; [k: string]: unknown;
  }) => <button disabled={disabled} data-testid={testId}>{children}</button>,
}));

vi.mock("wouter", () => ({
  Link: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
  useLocation: () => ["/", vi.fn()],
}));
vi.mock("@/lib/format", () => ({
  formatCurrency: (v: number) => `$${v}`,
}));
vi.mock("react-plaid-link", () => ({
  usePlaidLink: () => ({ open: vi.fn(), ready: false }),
}));

import React from "react";

// ─── 1. Accounting workspace passes selected slug to API hooks ─────────────────

describe("Accounting Workspace — entity slug propagation", () => {
  beforeEach(() => {
    accountingSlug = "CarDealer_ai";
    Object.keys(capturedAccountingSlugs).forEach((k) => delete capturedAccountingSlugs[k]);
  });

  it("1. passes activeSlug to useAccountingAccounts, useAccountingTransactions, useAccountingInvoices", async () => {
    const { default: WorkspacePage } = await import("../accounting/workspace");
    render(<WorkspacePage />);
    expect(capturedAccountingSlugs["accounts"]).toContain("CarDealer_ai");
    expect(capturedAccountingSlugs["transactions"]).toContain("CarDealer_ai");
    expect(capturedAccountingSlugs["invoices"]).toContain("CarDealer_ai");
  });

  it("2. when slug changes to T3_Marketing, hooks receive new slug (no cross-entity leakage)", async () => {
    accountingSlug = "T3_Marketing";
    const { default: WorkspacePage } = await import("../accounting/workspace");
    render(<WorkspacePage />);
    expect(capturedAccountingSlugs["accounts"]).toContain("T3_Marketing");
    expect(capturedAccountingSlugs["accounts"]).not.toContain("CarDealer_ai");
  });
});

// ─── 2. Accounting Customers — slug propagation ───────────────────────────────

describe("Accounting Customers — entity slug propagation", () => {
  beforeEach(() => {
    accountingSlug = "CarDealer_ai";
    Object.keys(capturedAccountingSlugs).forEach((k) => delete capturedAccountingSlugs[k]);
  });

  it("3. passes activeSlug to useAccountingCustomers", async () => {
    const { default: CustomersPage } = await import("../accounting/customers");
    render(<CustomersPage />);
    expect(capturedAccountingSlugs["customers"]).toContain("CarDealer_ai");
  });

  it("4. different entity slug reaches useAccountingCustomers without leaking prior slug", async () => {
    accountingSlug = "Kairox_Coaching";
    const { default: CustomersPage } = await import("../accounting/customers");
    render(<CustomersPage />);
    expect(capturedAccountingSlugs["customers"]).toContain("Kairox_Coaching");
    expect(capturedAccountingSlugs["customers"]).not.toContain("CarDealer_ai");
  });
});

// ─── 3. Accounting Vendors — slug propagation ─────────────────────────────────

describe("Accounting Vendors — entity slug propagation", () => {
  beforeEach(() => {
    accountingSlug = "CarDealer_ai";
    Object.keys(capturedAccountingSlugs).forEach((k) => delete capturedAccountingSlugs[k]);
  });

  it("5. passes activeSlug to useAccountingVendors", async () => {
    const { default: VendorsPage } = await import("../accounting/vendors");
    render(<VendorsPage />);
    expect(capturedAccountingSlugs["vendors"]).toContain("CarDealer_ai");
  });
});

// ─── 4. Budget Builder — slug propagation ─────────────────────────────────────

describe("Budget Builder — entity slug propagation", () => {
  beforeEach(() => {
    budgetSlug = "CarDealer_ai";
    Object.keys(capturedAccountingSlugs).forEach((k) => delete capturedAccountingSlugs[k]);
  });

  it("6. passes activeSlug to useEntityBudget", async () => {
    const { default: BudgetBuilderPage } = await import("../budget/builder");
    render(<BudgetBuilderPage />);
    expect(capturedAccountingSlugs["entityBudget"]).toContain("CarDealer_ai");
  });

  it("7. different entity slug reaches useEntityBudget without cross-entity leakage", async () => {
    budgetSlug = "T3_Marketing";
    const { default: BudgetBuilderPage } = await import("../budget/builder");
    render(<BudgetBuilderPage />);
    expect(capturedAccountingSlugs["entityBudget"]).toContain("T3_Marketing");
    expect(capturedAccountingSlugs["entityBudget"]).not.toContain("CarDealer_ai");
  });
});

// ─── 5. Accounting Settings — no hardcoded preference values ──────────────────

describe("Accounting Settings — no hardcoded live-data values", () => {
  beforeEach(() => {
    accountingSlug = "CarDealer_ai";
  });

  it("8. does NOT display 'January' / 'Accrual' / 'Net 14' as live accounting preferences", async () => {
    const { default: SettingsPage } = await import("../accounting/settings");
    render(<SettingsPage />);
    const banner = screen.getByTestId("accounting-prefs-not-implemented");
    expect(banner).toBeTruthy();
    // Hardcoded values must NOT appear as data cells
    expect(screen.queryByText("January")).toBeNull();
    expect(screen.queryByText("Accrual")).toBeNull();
    expect(screen.queryByText("Net 14")).toBeNull();
    expect(screen.queryByText("Net 30")).toBeNull();
  });

  it("9. still scopes bank connections section to selected entity slug", async () => {
    const { default: SettingsPage } = await import("../accounting/settings");
    render(<SettingsPage />);
    // Bank connections use live data via useAccountingAccounts(activeSlug)
    expect(capturedAccountingSlugs["accounts"]).toContain("CarDealer_ai");
  });
});

// ─── 6. Budget Settings — not-implemented banners, disabled save ──────────────

describe("Budget Settings — not-implemented banners and disabled save", () => {
  it("10. shows NotImplementedBanner for General Configuration", async () => {
    const { default: BudgetSettingsPage } = await import("../budget/settings");
    render(<BudgetSettingsPage />);
    expect(screen.getByTestId("not-implemented-General Configuration")).toBeTruthy();
  });

  it("11. shows NotImplementedBanner for Approval Workflow", async () => {
    const { default: BudgetSettingsPage } = await import("../budget/settings");
    render(<BudgetSettingsPage />);
    expect(screen.getByTestId("not-implemented-Approval Workflow")).toBeTruthy();
  });

  it("12. shows NotImplementedBanner for Departments", async () => {
    const { default: BudgetSettingsPage } = await import("../budget/settings");
    render(<BudgetSettingsPage />);
    expect(screen.getByTestId("not-implemented-Departments")).toBeTruthy();
  });

  it("13. shows NotImplementedBanner for Account Mapping", async () => {
    const { default: BudgetSettingsPage } = await import("../budget/settings");
    render(<BudgetSettingsPage />);
    expect(screen.getByTestId("not-implemented-Account Mapping")).toBeTruthy();
  });

  it("14. Save Configuration button is disabled", async () => {
    const { default: BudgetSettingsPage } = await import("../budget/settings");
    render(<BudgetSettingsPage />);
    const saveBtn = screen.getByTestId("button-save-settings");
    expect(saveBtn).toBeDisabled();
  });

  it("15. shows 'Settings persistence is not yet implemented' notice", async () => {
    const { default: BudgetSettingsPage } = await import("../budget/settings");
    render(<BudgetSettingsPage />);
    expect(screen.getByTestId("settings-not-persisted-notice")).toBeTruthy();
  });
});

// ─── 7. Honest stubs — static pages don't show mock data ──────────────────────

describe("Honest stub pages — no mock/static data presented as live", () => {
  it("16. Journal Entries page shows not-available notice, no table data", async () => {
    const { default: JournalEntriesPage } = await import("../accounting/journal-entries");
    render(<JournalEntriesPage />);
    expect(screen.getByText(/not available/i)).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("17. Fixed Assets page shows not-available notice, no table data", async () => {
    const { default: FixedAssetsPage } = await import("../accounting/fixed-assets");
    render(<FixedAssetsPage />);
    expect(screen.getByText(/not available/i)).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("18. Month-End Close page shows not-available notice, no table data", async () => {
    const { default: MonthEndClosePage } = await import("../accounting/month-end-close");
    render(<MonthEndClosePage />);
    expect(screen.getByText(/not available/i)).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("19. Categorization Rules page shows planned-for-future notice, no table data", async () => {
    const { default: RulesPage } = await import("../accounting/rules");
    render(<RulesPage />);
    expect(screen.getByText(/planned for a future release/i)).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
  });
});
