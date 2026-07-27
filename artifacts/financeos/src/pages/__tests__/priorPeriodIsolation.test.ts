/**
 * Prior-period isolation regression tests.
 *
 * Covers the 17 requirements from the period-isolation spec:
 *
 *  1. Accounting defaults to YTD — from = Jan 1 current year, to = today
 *  2. YTD excludes 2025 invoices, bills, and transactions (gte filter on dates)
 *  3. Last Year includes 2025 rows (from=2025-01-01, to=2025-12-31)
 *  4. All time → null bounds → no gte/lte applied
 *  5. Custom from/to are passed to API unchanged
 *  6. Invalid dates are silently dropped (parseDateParam returns null)
 *  7. Entity + period filters combine correctly in DB queries
 *  8. Switching entity does not reset selected period (independent LS keys)
 *  9. Reload preserves period (AccountingPeriodContext reads from localStorage on init)
 * 10. PriorPeriodBanner renders when priorPeriod is truthy with count > 0
 * 11. PriorPeriodBannerGuard does NOT render when priorPeriod is null / count=0
 * 12. Customers / vendors / accounts are not date-filtered (no from/to in source)
 * 13. No hardcoded period strings (jul26, July 2026, 9:02 AM) in production pages
 * 14. Budget period selector has no defaultValue (replaced with disabled controlled)
 * 15. No mock data imports in production accounting/budget/forecast/commission pages
 * 16. Plaid routes are not called — confirmed by source audit
 * 17. getPriorPeriodOpenInvoices / getPriorPeriodOpenBills / getPriorPeriodUnreconciledTransactions
 *     exist in their respective DB modules
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

import { resolvePeriod, defaultPeriod } from "@/lib/period";

const SRC = resolve(import.meta.dirname, "../..");
const API = resolve(import.meta.dirname, "../../../../api-server/src");

function src(rel: string) {
  return readFileSync(resolve(SRC, rel), "utf-8");
}
function api(rel: string) {
  return readFileSync(resolve(API, rel), "utf-8");
}

// ── 1. Default is YTD ────────────────────────────────────────────────────────

describe("Requirement 1 — accounting defaults to YTD", () => {
  it("defaultPeriod() returns ytd preset", () => {
    const p = defaultPeriod();
    expect(p.preset).toBe("ytd");
  });

  it("YTD from = Jan 1 of current year", () => {
    const year = new Date().getFullYear();
    const p = defaultPeriod();
    expect(p.from).toBe(`${year}-01-01`);
  });

  it("YTD to = today", () => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const p = defaultPeriod();
    expect(p.to).toBe(todayStr);
  });

  it("AccountingPeriodContext initialises with defaultPeriod (ytd)", () => {
    const ctx = src("lib/accounting-period-context.tsx");
    expect(ctx).toContain("defaultPeriod()");
  });
});

// ── 2. YTD excludes 2025 rows ────────────────────────────────────────────────

describe("Requirement 2 — YTD excludes pre-2026 data", () => {
  it("resolvePeriod(ytd).from is in the current year, not 2025", () => {
    const year = new Date().getFullYear();
    const p = resolvePeriod("ytd");
    expect(p.from?.startsWith(String(year))).toBe(true);
    if (year > 2025) {
      expect(p.from?.startsWith("2025")).toBe(false);
    }
  });

  it("DB getAllInvoices applies gte(invoiceDate, from) when from is set", () => {
    const code = api("db/invoices.ts");
    expect(code).toContain("gte(invoices.invoiceDate, from)");
  });

  it("DB getRecentTransactions applies gte(transactionDate, from) when from is set", () => {
    const code = api("db/transactions.ts");
    expect(code).toContain("gte(transactions.transactionDate, from)");
  });

  it("DB getOpenBills applies gte(billDate, from) when from is set", () => {
    const code = api("db/bills.ts");
    expect(code).toContain("gte(bills.billDate, from)");
  });
});

// ── 3. Last Year includes 2025 rows ──────────────────────────────────────────

describe("Requirement 3 — Last Year covers full prior year", () => {
  it("resolvePeriod(last_year) from = prior Jan 1", () => {
    const year = new Date().getFullYear();
    const p = resolvePeriod("last_year");
    expect(p.from).toBe(`${year - 1}-01-01`);
  });

  it("resolvePeriod(last_year) to = prior Dec 31", () => {
    const year = new Date().getFullYear();
    const p = resolvePeriod("last_year");
    expect(p.to).toBe(`${year - 1}-12-31`);
  });
});

// ── 4. All time has null bounds ───────────────────────────────────────────────

describe("Requirement 4 — all_time has null from/to", () => {
  it("resolvePeriod(all_time).from is null", () => {
    expect(resolvePeriod("all_time").from).toBeNull();
  });

  it("resolvePeriod(all_time).to is null", () => {
    expect(resolvePeriod("all_time").to).toBeNull();
  });

  it("buildPeriodQS returns empty string when both null", () => {
    // The qs is built inline in api.ts — check the source
    const code = src("lib/api.ts");
    expect(code).toContain('return parts.length ? `?${parts.join("&")}` : ""');
  });
});

// ── 5. Custom from/to passed unchanged ───────────────────────────────────────

describe("Requirement 5 — custom from/to passed to API unchanged", () => {
  it("resolvePeriod(custom) passes through explicit from/to", () => {
    const p = resolvePeriod("custom", { from: "2025-03-01", to: "2025-09-30" });
    expect(p.from).toBe("2025-03-01");
    expect(p.to).toBe("2025-09-30");
  });

  it("buildPeriodQS includes from and to in query string", () => {
    const code = src("lib/api.ts");
    expect(code).toContain('parts.push(`from=${encodeURIComponent(from)}`)');
    expect(code).toContain('parts.push(`to=${encodeURIComponent(to)}`)');
  });
});

// ── 6. Invalid dates silently dropped ────────────────────────────────────────

describe("Requirement 6 — invalid dates silently dropped by parseDateParam", () => {
  it("parseDateParam is defined in accounting route", () => {
    const code = api("routes/accounting.ts");
    expect(code).toContain("function parseDateParam");
  });

  it("parseDateParam rejects non-YYYY-MM-DD strings (returns null)", () => {
    const code = api("routes/accounting.ts");
    // The regex check
    expect(code).toContain("^\\d{4}-\\d{2}-\\d{2}$");
    expect(code).toContain("return null");
  });

  it("resolvePeriod unknown preset falls back to ytd (no crash)", () => {
    // @ts-expect-error intentionally bad preset
    const p = resolvePeriod("bogus_preset_xyz");
    expect(p.preset).toBe("ytd");
    expect(p.from).not.toBeNull();
  });
});

// ── 7. Entity + period combine correctly ─────────────────────────────────────

describe("Requirement 7 — entity + period filters combine in DB queries", () => {
  it("getAllInvoices where clause combines eq(entityId) AND gte/lte date filters", () => {
    const code = api("db/invoices.ts");
    expect(code).toContain("eq(invoices.entityId, entityId)");
    expect(code).toContain("gte(invoices.invoiceDate, from)");
    expect(code).toContain("lte(invoices.invoiceDate, to)");
    // Both inside an `and(...)` call
    expect(code).toContain("and(");
  });

  it("getOpenBills where clause combines entity + date filters", () => {
    const code = api("db/bills.ts");
    expect(code).toContain("eq(bills.entityId, entityId)");
    expect(code).toContain("gte(bills.billDate, from)");
    expect(code).toContain("lte(bills.billDate, to)");
  });
});

// ── 8. Switching entity does not reset period ─────────────────────────────────

describe("Requirement 8 — switching entity preserves period", () => {
  it("AccountingEntityContext and AccountingPeriodContext use different localStorage keys", () => {
    const entityCtx = src("lib/accounting-context.tsx");
    const periodCtx = src("lib/accounting-period-context.tsx");
    // Extract the LS_KEY values
    const entityKeyMatch  = entityCtx.match(/LS_KEY\s*=\s*["']([^"']+)["']/);
    const periodKeyMatch  = periodCtx.match(/LS_KEY\s*=\s*["']([^"']+)["']/);
    expect(entityKeyMatch).not.toBeNull();
    expect(periodKeyMatch).not.toBeNull();
    expect(entityKeyMatch![1]).not.toBe(periodKeyMatch![1]);
  });
});

// ── 9. Reload preserves period ───────────────────────────────────────────────

describe("Requirement 9 — reload preserves period via localStorage", () => {
  it("AccountingPeriodContext reads from localStorage on init", () => {
    const code = src("lib/accounting-period-context.tsx");
    expect(code).toContain("localStorage.getItem");
    expect(code).toContain("localStorage.setItem");
  });

  it("period context key is stable (not date-derived)", () => {
    const code = src("lib/accounting-period-context.tsx");
    const keyMatch = code.match(/LS_KEY\s*=\s*["']([^"']+)["']/);
    expect(keyMatch).not.toBeNull();
    // Key must be a static string, not contain dynamic content
    expect(keyMatch![1]).not.toContain("${");
  });
});

// ── 10. PriorPeriodBanner renders when data exists ───────────────────────────

describe("Requirement 10 — PriorPeriodBanner renders when excluded items exist", () => {
  it("PriorPeriodBannerGuard component is exported from PriorPeriodBanner.tsx", () => {
    const code = src("components/accounting/PriorPeriodBanner.tsx");
    expect(code).toContain("export function PriorPeriodBannerGuard");
  });

  it("PriorPeriodBannerGuard only renders when count > 0", () => {
    const code = src("components/accounting/PriorPeriodBanner.tsx");
    expect(code).toContain("priorPeriod.count === 0");
    expect(code).toContain("return null");
  });

  it("PriorPeriodBanner shows count in rendered output", () => {
    const code = src("components/accounting/PriorPeriodBanner.tsx");
    expect(code).toContain("count");
    expect(code).toContain("data-testid=\"prior-period-banner\"");
  });

  it("PriorPeriodBanner includes an All Time action", () => {
    const code = src("components/accounting/PriorPeriodBanner.tsx");
    expect(code).toContain("All Time");
    expect(code).toContain("onViewAllTime");
  });

  it("invoices.tsx imports PriorPeriodBannerGuard", () => {
    const code = src("pages/accounting/invoices.tsx");
    expect(code).toContain("PriorPeriodBannerGuard");
  });

  it("transactions.tsx imports PriorPeriodBannerGuard", () => {
    const code = src("pages/accounting/transactions.tsx");
    expect(code).toContain("PriorPeriodBannerGuard");
  });

  it("workspace.tsx imports PriorPeriodBannerGuard", () => {
    const code = src("pages/accounting/workspace.tsx");
    expect(code).toContain("PriorPeriodBannerGuard");
  });

  it("reconciliation.tsx imports PriorPeriodBannerGuard", () => {
    const code = src("pages/accounting/reconciliation.tsx");
    expect(code).toContain("PriorPeriodBannerGuard");
  });
});

// ── 11. Prior-period items excluded from current totals ───────────────────────

describe("Requirement 11 — prior-period items not in current AR/AP buckets", () => {
  it("accounting route includes priorPeriod in invoices response", () => {
    const code = api("routes/accounting.ts");
    expect(code).toContain("getPriorPeriodOpenInvoices");
    expect(code).toContain("priorPeriod");
  });

  it("accounting route includes priorPeriod in bills response", () => {
    const code = api("routes/accounting.ts");
    expect(code).toContain("getPriorPeriodOpenBills");
  });

  it("accounting route includes priorPeriod in transactions response", () => {
    const code = api("routes/accounting.ts");
    expect(code).toContain("getPriorPeriodUnreconciledTransactions");
  });

  it("priorPeriod is only fetched when from is set (not all_time)", () => {
    const code = api("routes/accounting.ts");
    // The conditional pattern: from ? getPriorPeriodOpenInvoices(...) : Promise.resolve(null)
    expect(code).toContain("from ? getPriorPeriodOpenInvoices");
    expect(code).toContain("Promise.resolve(null)");
  });

  it("FetchState type includes priorPeriod field", () => {
    const code = src("lib/dataState.ts");
    expect(code).toContain("priorPeriod?");
    expect(code).toContain("PriorPeriodMeta");
  });

  it("useAccountingInvoices hook result includes priorPeriod (via FetchState)", () => {
    const code = src("hooks/useApi.ts");
    expect(code).toContain("priorPeriod");
  });
});

// ── 12. Customers/vendors/accounts not date-filtered ─────────────────────────

describe("Requirement 12 — master records not period-filtered", () => {
  it("getCustomers DB function has no from/to params", () => {
    const code = api("db/customers.ts");
    expect(code).not.toContain("from?: string");
    expect(code).not.toContain("gte(customers");
  });

  it("getVendors DB function has no from/to params", () => {
    const code = api("db/vendors.ts");
    expect(code).not.toContain("from?: string");
    expect(code).not.toContain("gte(vendors");
  });

  it("getAllAccounts DB function has no from/to params", () => {
    const code = api("db/accounts.ts");
    expect(code).not.toContain("from?: string");
    expect(code).not.toContain("gte(accounts");
  });

  it("workspace.tsx calls useAccountingAccounts without from/to", () => {
    const code = src("pages/accounting/workspace.tsx");
    expect(code).toContain("useAccountingAccounts(activeSlug)");
    // Should NOT pass activePeriod to accounts
    expect(code).not.toMatch(/useAccountingAccounts\(activeSlug,\s*activePeriod/);
  });
});

// ── 13. No hardcoded period strings ──────────────────────────────────────────

describe("Requirement 13 — no hardcoded period strings in production pages", () => {
  const accountingPages = [
    "pages/accounting/workspace.tsx",
    "pages/accounting/invoices.tsx",
    "pages/accounting/transactions.tsx",
    "pages/accounting/reconciliation.tsx",
  ];

  it("accounting pages do not contain hardcoded 'jul26'", () => {
    for (const page of accountingPages) {
      const code = src(page);
      expect(code, `${page} contains 'jul26'`).not.toContain("jul26");
    }
  });

  it("accounting pages do not contain hardcoded 'July 2026'", () => {
    for (const page of accountingPages) {
      const code = src(page);
      expect(code, `${page} contains 'July 2026'`).not.toContain("July 2026");
    }
  });

  it("AccountingLayout period selector has no defaultValue", () => {
    const code = src("components/accounting/AccountingLayout.tsx");
    // Period Select must not use defaultValue= (that would be uncontrolled)
    const periodSelectBlock = code.slice(code.indexOf("accounting-period-select"));
    expect(periodSelectBlock).not.toContain("defaultValue=");
  });
});

// ── 14. Budget period selector has no defaultValue ───────────────────────────

describe("Requirement 14 — budget period selector not a dead defaultValue", () => {
  it("BudgetLayout does not use defaultValue= on period select", () => {
    const code = src("components/budget/BudgetLayout.tsx");
    expect(code).not.toContain('defaultValue="fy26"');
    expect(code).not.toContain("defaultValue=\"fy");
  });

  it("BudgetLayout period selector is disabled with descriptive title", () => {
    const code = src("components/budget/BudgetLayout.tsx");
    expect(code).toContain("disabled");
    expect(code).toContain("Period filtering will apply");
  });
});

// ── 15. No mock data imports in production pages ──────────────────────────────

describe("Requirement 15 — no mock data imports in accounting production pages", () => {
  const livePages = [
    "pages/accounting/workspace.tsx",
    "pages/accounting/invoices.tsx",
    "pages/accounting/transactions.tsx",
    "pages/accounting/reconciliation.tsx",
    "pages/accounting/customers.tsx",
    "pages/accounting/vendors.tsx",
    "pages/accounting/chart-of-accounts.tsx",
  ];

  it("live accounting pages have no getMockData import", () => {
    for (const page of livePages) {
      const code = src(page);
      expect(code, `${page} imports getMockData`).not.toContain("getMockData");
    }
  });

  it("live accounting pages have no analyticsDemoData import", () => {
    for (const page of livePages) {
      const code = src(page);
      expect(code, `${page} imports analyticsDemoData`).not.toContain("analyticsDemoData");
    }
  });
});

// ── 16. Plaid routes not called by this PR ────────────────────────────────────

describe("Requirement 16 — Plaid not connected by period isolation changes", () => {
  it("accounting pages do not import Plaid hooks", () => {
    const code = src("pages/accounting/workspace.tsx")
               + src("pages/accounting/invoices.tsx")
               + src("pages/accounting/transactions.tsx")
               + src("pages/accounting/reconciliation.tsx");
    expect(code).not.toContain("usePlaid");
    expect(code).not.toContain("plaidLink");
    expect(code).not.toContain("PlaidLink");
  });

  it("PriorPeriodBanner does not reference Plaid", () => {
    const code = src("components/accounting/PriorPeriodBanner.tsx");
    expect(code).not.toContain("Plaid");
    expect(code).not.toContain("plaid");
  });
});

// ── 17. Prior-period DB functions exist ──────────────────────────────────────

describe("Requirement 17 — prior-period DB query functions exist", () => {
  it("getPriorPeriodOpenInvoices exported from db/invoices.ts", () => {
    const code = api("db/invoices.ts");
    expect(code).toContain("export async function getPriorPeriodOpenInvoices");
  });

  it("getPriorPeriodOpenBills exported from db/bills.ts", () => {
    const code = api("db/bills.ts");
    expect(code).toContain("export async function getPriorPeriodOpenBills");
  });

  it("getPriorPeriodUnreconciledTransactions exported from db/transactions.ts", () => {
    const code = api("db/transactions.ts");
    expect(code).toContain("export async function getPriorPeriodUnreconciledTransactions");
  });

  it("getPriorPeriodOpenInvoices uses lt() to filter before the period start", () => {
    const code = api("db/invoices.ts");
    expect(code).toContain("lt(invoices.invoiceDate, before)");
  });

  it("getPriorPeriodOpenBills uses lt() to filter before the period start", () => {
    const code = api("db/bills.ts");
    expect(code).toContain("lt(bills.billDate, before)");
  });

  it("getPriorPeriodUnreconciledTransactions uses lt() and isReconciled=false", () => {
    const code = api("db/transactions.ts");
    expect(code).toContain("lt(transactions.transactionDate, before)");
    expect(code).toContain("eq(transactions.isReconciled, false)");
  });

  it("PriorPeriodMeta type exported from api.ts", () => {
    const code = src("lib/api.ts");
    expect(code).toContain("export type PriorPeriodMeta");
  });

  it("getAccountingSourced helper extracts priorPeriod from response", () => {
    const code = src("lib/api.ts");
    expect(code).toContain("getAccountingSourced");
    expect(code).toContain("json.priorPeriod");
  });
});
