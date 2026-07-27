/**
 * Period filter regression tests.
 *
 * Covers:
 *   1.  resolvePeriod("ytd") — from = Jan 1 current year, to = today
 *   2.  resolvePeriod("last_year") — full prior calendar year
 *   3.  resolvePeriod("last_6_months") — ~6 months back from today
 *   4.  resolvePeriod("last_3_months") — ~3 months back from today
 *   5.  resolvePeriod("last_12_months") — ~12 months back from today
 *   6.  resolvePeriod("this_month") — 1st of current month → today
 *   7.  resolvePeriod("all_time") — both null
 *   8.  resolvePeriod("custom") — passes through explicit from/to
 *   9.  YTD excludes prior year (2025 when current year is 2026)
 *   10. Last Year from/to are within prior year only
 *   11. defaultPeriod() returns ytd preset
 *   12. periodQueryParams builds correct query string
 *   13. periodQueryParams returns "" when both null
 *   14. PERIOD_PRESET_OPTIONS contains all expected presets (no "custom")
 *   15. AccountingPeriodContext source — accounting-period-context.tsx exports exist
 *   16. App.tsx imports AccountingPeriodProvider
 *   17. App.tsx wraps AccountingRoutes with AccountingPeriodProvider
 *   18. AccountingLayout imports useAccountingPeriod
 *   19. AccountingLayout selector uses value={activePeriod.preset} (controlled)
 *   20. AccountingLayout selector does NOT use defaultValue="jul26"
 *   21. Invoices page imports useAccountingPeriod
 *   22. Invoices hook call passes from/to from activePeriod
 *   23. Transactions page imports useAccountingPeriod
 *   24. Transactions hook call passes from/to from activePeriod
 *   25. Workspace page imports useAccountingPeriod
 *   26. Workspace hook calls pass from/to from activePeriod
 *   27. Reconciliation page imports useAccountingPeriod (transactions only)
 *   28. Backend invoices route contains parseDateParam helper
 *   29. Backend invoices route passes from/to to getAllInvoices
 *   30. Backend transactions route passes from/to to getRecentTransactions
 *   31. Backend bills route passes from/to to getOpenBills
 *   32. DB getAllInvoices accepts from/to params
 *   33. DB getRecentTransactions accepts from/to params
 *   34. DB getOpenBills accepts from/to params
 *   35. Switching entity does not reset period (independent contexts)
 *   36. useAccountingInvoices cache key includes from/to
 *   37. useAccountingTransactions cache key includes from/to
 *   38. useAccountingBills cache key includes from/to
 *   39. Chart of accounts (accounts) is NOT period-filtered in workspace
 *   40. Chart of accounts endpoint does not accept from/to in route source
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

// ── helpers ───────────────────────────────────────────────────────────────────

const SRC  = resolve(import.meta.dirname, "../..");
const API  = resolve(import.meta.dirname, "../../../../api-server/src");
const TESTS_DIR = import.meta.dirname;

function src(rel: string) {
  return readFileSync(resolve(SRC, rel), "utf-8");
}
function api(rel: string) {
  return readFileSync(resolve(API, rel), "utf-8");
}

// ── 1–8. resolvePeriod correctness ───────────────────────────────────────────

import { resolvePeriod, defaultPeriod, periodQueryParams, PERIOD_PRESET_OPTIONS } from "@/lib/period";

describe("resolvePeriod — preset date math", () => {
  const NOW = new Date();
  const Y   = NOW.getFullYear();
  const todayStr = NOW.toISOString().slice(0, 10);

  it("1. ytd: from = Jan 1 current year, to = today", () => {
    const p = resolvePeriod("ytd");
    expect(p.preset).toBe("ytd");
    expect(p.from).toBe(`${Y}-01-01`);
    expect(p.to).toBe(todayStr);
    expect(p.label).toContain(String(Y));
  });

  it("2. last_year: full prior calendar year", () => {
    const p = resolvePeriod("last_year");
    const ly = Y - 1;
    expect(p.preset).toBe("last_year");
    expect(p.from).toBe(`${ly}-01-01`);
    expect(p.to).toBe(`${ly}-12-31`);
    expect(p.label).toBe(String(ly));
  });

  it("3. last_6_months: from is ~6 months before today", () => {
    const p = resolvePeriod("last_6_months");
    expect(p.from).not.toBeNull();
    expect(p.to).toBe(todayStr);
    const fromDate = new Date(p.from!);
    const diffDays = Math.round((NOW.getTime() - fromDate.getTime()) / 86400000);
    // 6 months ≈ 180–184 days
    expect(diffDays).toBeGreaterThanOrEqual(180);
    expect(diffDays).toBeLessThanOrEqual(186);
  });

  it("4. last_3_months: from is ~3 months before today", () => {
    const p = resolvePeriod("last_3_months");
    expect(p.from).not.toBeNull();
    const fromDate = new Date(p.from!);
    const diffDays = Math.round((NOW.getTime() - fromDate.getTime()) / 86400000);
    // 3 months ≈ 89–93 days
    expect(diffDays).toBeGreaterThanOrEqual(89);
    expect(diffDays).toBeLessThanOrEqual(94);
  });

  it("5. last_12_months: from is ~12 months before today", () => {
    const p = resolvePeriod("last_12_months");
    expect(p.from).not.toBeNull();
    const fromDate = new Date(p.from!);
    const diffDays = Math.round((NOW.getTime() - fromDate.getTime()) / 86400000);
    // 12 months ≈ 364–366 days
    expect(diffDays).toBeGreaterThanOrEqual(364);
    expect(diffDays).toBeLessThanOrEqual(367);
  });

  it("6. this_month: from = 1st of current month, to = today", () => {
    const p = resolvePeriod("this_month");
    const m = String(NOW.getMonth() + 1).padStart(2, "0");
    expect(p.from).toBe(`${Y}-${m}-01`);
    expect(p.to).toBe(todayStr);
  });

  it("7. all_time: both from and to are null", () => {
    const p = resolvePeriod("all_time");
    expect(p.from).toBeNull();
    expect(p.to).toBeNull();
    expect(p.label).toBe("All time");
  });

  it("8. custom: passes through explicit from/to unchanged", () => {
    const p = resolvePeriod("custom", { from: "2025-01-01", to: "2025-12-31" });
    expect(p.from).toBe("2025-01-01");
    expect(p.to).toBe("2025-12-31");
    expect(p.preset).toBe("custom");
    expect(p.label).toContain("2025-01-01");
  });
});

// ── 9–10. YTD excludes prior year ─────────────────────────────────────────────

describe("Period boundary correctness", () => {
  it("9. YTD from date is in current year — excludes all prior-year dates", () => {
    const p = resolvePeriod("ytd");
    const y = new Date().getFullYear();
    expect(p.from!.startsWith(String(y))).toBe(true);
    // A 2025 date should be before from (when current year is 2026)
    if (y > 2025) {
      expect("2025-12-31" < p.from!).toBe(true);
    }
  });

  it("10. Last Year to date ends at Dec 31 of prior year — not in current year", () => {
    const p = resolvePeriod("last_year");
    const ly = new Date().getFullYear() - 1;
    expect(p.from!.startsWith(String(ly))).toBe(true);
    expect(p.to!.startsWith(String(ly))).toBe(true);
    expect(p.to).toBe(`${ly}-12-31`);
  });
});

// ── 11. defaultPeriod ─────────────────────────────────────────────────────────

describe("defaultPeriod", () => {
  it("11. defaultPeriod() returns ytd preset", () => {
    const p = defaultPeriod();
    expect(p.preset).toBe("ytd");
    expect(p.from).not.toBeNull();
    expect(p.to).not.toBeNull();
  });
});

// ── 12–13. periodQueryParams ──────────────────────────────────────────────────

describe("periodQueryParams", () => {
  it("12. builds ?from=…&to=… query string", () => {
    const qs = periodQueryParams("2026-01-01", "2026-07-27");
    expect(qs).toBe("?from=2026-01-01&to=2026-07-27");
  });

  it("13. returns empty string when both null", () => {
    expect(periodQueryParams(null, null)).toBe("");
    expect(periodQueryParams(undefined as unknown as null, undefined as unknown as null)).toBe("");
  });
});

// ── 14. PERIOD_PRESET_OPTIONS ─────────────────────────────────────────────────

describe("PERIOD_PRESET_OPTIONS", () => {
  it("14. contains ytd, last_year, last_12_months, last_6_months, last_3_months, this_month, all_time; no custom", () => {
    const values = PERIOD_PRESET_OPTIONS.map(o => o.value);
    expect(values).toContain("ytd");
    expect(values).toContain("last_year");
    expect(values).toContain("last_12_months");
    expect(values).toContain("last_6_months");
    expect(values).toContain("last_3_months");
    expect(values).toContain("this_month");
    expect(values).toContain("all_time");
    // custom requires a date picker — excluded from the dropdown
    expect(values).not.toContain("custom");
  });
});

// ── 15–17. App / provider wiring ─────────────────────────────────────────────

describe("AccountingPeriodProvider wiring", () => {
  it("15. accounting-period-context exports AccountingPeriodProvider and useAccountingPeriod", () => {
    const content = src("lib/accounting-period-context.tsx");
    expect(content).toContain("export function AccountingPeriodProvider");
    expect(content).toContain("export function useAccountingPeriod");
  });

  it("16. App.tsx imports AccountingPeriodProvider", () => {
    const content = src("App.tsx");
    expect(content).toContain("AccountingPeriodProvider");
    expect(content).toContain('from "@/lib/accounting-period-context"');
  });

  it("17. App.tsx wraps AccountingRoutes with AccountingPeriodProvider", () => {
    const content = src("App.tsx");
    const routeStart = content.indexOf("function AccountingRoutes()");
    const routeEnd   = content.indexOf("\nfunction ", routeStart + 1);
    const routeFn    = content.slice(routeStart, routeEnd);
    expect(routeFn).toContain("<AccountingPeriodProvider>");
    expect(routeFn).toContain("</AccountingPeriodProvider>");
  });
});

// ── 18–20. AccountingLayout period selector ───────────────────────────────────

describe("AccountingLayout — period selector is controlled", () => {
  it("18. AccountingLayout imports useAccountingPeriod", () => {
    const content = src("components/accounting/AccountingLayout.tsx");
    expect(content).toContain("useAccountingPeriod");
  });

  it("19. period Select uses value={activePeriod.preset} (controlled)", () => {
    const content = src("components/accounting/AccountingLayout.tsx");
    expect(content).toContain("value={activePeriod.preset}");
    expect(content).toContain("onValueChange");
    expect(content).toContain("setPreset");
  });

  it("20. period selector does NOT use the dead defaultValue='jul26'", () => {
    const content = src("components/accounting/AccountingLayout.tsx");
    expect(content).not.toContain('defaultValue="jul26"');
    expect(content).not.toContain('defaultValue="july"');
    expect(content).not.toContain("July 2026");
  });
});

// ── 21–27. Accounting pages pass from/to ─────────────────────────────────────

describe("Accounting pages — period passed to hooks", () => {
  it("21. invoices.tsx imports useAccountingPeriod", () => {
    const content = src("pages/accounting/invoices.tsx");
    expect(content).toContain("useAccountingPeriod");
  });

  it("22. invoices.tsx passes activePeriod.from/to to useAccountingInvoices", () => {
    const content = src("pages/accounting/invoices.tsx");
    expect(content).toContain("activePeriod");
    expect(content).toContain("activePeriod.from");
    expect(content).toContain("activePeriod.to");
    expect(content).toContain("useAccountingInvoices(activeSlug, activePeriod.from, activePeriod.to)");
  });

  it("23. transactions.tsx imports useAccountingPeriod", () => {
    const content = src("pages/accounting/transactions.tsx");
    expect(content).toContain("useAccountingPeriod");
  });

  it("24. transactions.tsx passes activePeriod.from/to to useAccountingTransactions", () => {
    const content = src("pages/accounting/transactions.tsx");
    expect(content).toContain("useAccountingTransactions(activeSlug, activePeriod.from, activePeriod.to)");
  });

  it("25. workspace.tsx imports useAccountingPeriod", () => {
    const content = src("pages/accounting/workspace.tsx");
    expect(content).toContain("useAccountingPeriod");
  });

  it("26. workspace.tsx passes period to both useAccountingTransactions and useAccountingInvoices", () => {
    const content = src("pages/accounting/workspace.tsx");
    expect(content).toContain("useAccountingTransactions(activeSlug, activePeriod.from, activePeriod.to)");
    expect(content).toContain("useAccountingInvoices(activeSlug, activePeriod.from, activePeriod.to)");
  });

  it("27. reconciliation.tsx imports useAccountingPeriod and passes period to transactions only", () => {
    const content = src("pages/accounting/reconciliation.tsx");
    expect(content).toContain("useAccountingPeriod");
    expect(content).toContain("useAccountingTransactions(activeSlug, activePeriod.from, activePeriod.to)");
    // accounts (Chart of Accounts) must NOT be period-filtered
    expect(content).toContain("useAccountingAccounts(activeSlug)");
    expect(content).not.toMatch(/useAccountingAccounts\(activeSlug,\s*activePeriod/);
  });
});

// ── 28–31. Backend routes parse and forward from/to ──────────────────────────

describe("Backend routes — from/to wiring", () => {
  it("28. accounting.ts route has parseDateParam helper", () => {
    const content = api("routes/accounting.ts");
    expect(content).toContain("function parseDateParam");
    expect(content).toContain(/^\d{4}-\d{2}-\d{2}$/.source);
  });

  it("29. invoices route passes from/to to getAllInvoices", () => {
    const content = api("routes/accounting.ts");
    // find the invoices route block
    const routeStart = content.indexOf('"/accounting/:slug/invoices"');
    const routeEnd   = content.indexOf('"/accounting/:slug/accounts"', routeStart);
    const block      = content.slice(routeStart, routeEnd);
    expect(block).toContain("parseDateParam");
    expect(block).toContain("getAllInvoices(entityId, limit, from, to)");
  });

  it("30. transactions route passes from/to to getRecentTransactions", () => {
    const content = api("routes/accounting.ts");
    const routeStart = content.indexOf('"/accounting/:slug/transactions"');
    const routeEnd   = content.indexOf('"/accounting/:slug/bills"', routeStart);
    const block      = content.slice(routeStart, routeEnd);
    expect(block).toContain("parseDateParam");
    expect(block).toContain("getRecentTransactions(entityId, limit, from, to)");
  });

  it("31. bills route passes from/to to getOpenBills", () => {
    const content = api("routes/accounting.ts");
    const routeStart = content.indexOf('"/accounting/:slug/bills"');
    const block      = content.slice(routeStart, routeStart + 800);
    expect(block).toContain("parseDateParam");
    expect(block).toContain("getOpenBills(entityId, fromBills, toBills)");
  });
});

// ── 32–34. DB functions accept from/to ───────────────────────────────────────

describe("DB query functions — from/to parameters", () => {
  it("32. getAllInvoices accepts from/to and uses gte/lte", () => {
    const content = api("db/invoices.ts");
    expect(content).toContain("from?: string | null");
    expect(content).toContain("to?: string | null");
    expect(content).toContain("gte(invoices.invoiceDate, from)");
    expect(content).toContain("lte(invoices.invoiceDate, to)");
    expect(content).toContain("gte, lte");
  });

  it("33. getRecentTransactions accepts from/to and uses gte/lte", () => {
    const content = api("db/transactions.ts");
    expect(content).toContain("from?: string | null");
    expect(content).toContain("to?: string | null");
    expect(content).toContain("gte(transactions.transactionDate, from)");
    expect(content).toContain("lte(transactions.transactionDate, to)");
    expect(content).toContain("gte, lte");
  });

  it("34. getOpenBills accepts from/to and uses gte/lte", () => {
    const content = api("db/bills.ts");
    expect(content).toContain("from?: string | null");
    expect(content).toContain("to?: string | null");
    expect(content).toContain("gte(bills.billDate, from)");
    expect(content).toContain("lte(bills.billDate, to)");
    expect(content).toContain("gte, lte");
  });
});

// ── 35. Entity + period independence ─────────────────────────────────────────

describe("Entity and period independence", () => {
  it("35. Entity and period use separate localStorage keys (independent contexts)", () => {
    const entityCtx = src("lib/accounting-context.tsx");
    const periodCtx = src("lib/accounting-period-context.tsx");
    const entityKey = entityCtx.match(/LS_KEY\s*=\s*["']([^"']+)["']/)?.[1];
    const periodKey = periodCtx.match(/LS_KEY\s*=\s*["']([^"']+)["']/)?.[1];
    expect(entityKey).toBeTruthy();
    expect(periodKey).toBeTruthy();
    expect(entityKey).not.toBe(periodKey);
  });
});

// ── 36–38. Hook cache keys include from/to ────────────────────────────────────

describe("useApi hooks — cache keys include from/to", () => {
  it("36. useAccountingInvoices cache key includes from and to", () => {
    const content = src("hooks/useApi.ts");
    // find useAccountingInvoices
    const fnStart = content.indexOf("export function useAccountingInvoices");
    const fnEnd   = content.indexOf("\nexport function ", fnStart + 1);
    const fn      = content.slice(fnStart, fnEnd);
    expect(fn).toContain("from ?? \"\"");
    expect(fn).toContain("to ?? \"\"");
    expect(fn).toContain("[slug, from, to]");
  });

  it("37. useAccountingTransactions cache key includes from and to", () => {
    const content = src("hooks/useApi.ts");
    const fnStart = content.indexOf("export function useAccountingTransactions");
    const fnEnd   = content.indexOf("\nexport function ", fnStart + 1);
    const fn      = content.slice(fnStart, fnEnd);
    expect(fn).toContain("from ?? \"\"");
    expect(fn).toContain("[slug, from, to]");
  });

  it("38. useAccountingBills cache key includes from and to", () => {
    const content = src("hooks/useApi.ts");
    const fnStart = content.indexOf("export function useAccountingBills");
    const fnEnd   = content.indexOf("\nexport function ", fnStart + 1);
    const fn      = content.slice(fnStart, fnEnd > fnStart ? fnEnd : content.length);
    expect(fn).toContain("from ?? \"\"");
    expect(fn).toContain("[slug, from, to]");
  });
});

// ── 39–40. Chart of accounts is NOT period-filtered ──────────────────────────

describe("Chart of accounts — correctly excluded from period filtering", () => {
  it("39. workspace.tsx calls useAccountingAccounts without period params (master record)", () => {
    const content = src("pages/accounting/workspace.tsx");
    // The accounts hook must be called with only slug, not with period params
    expect(content).toContain("useAccountingAccounts(activeSlug)");
    expect(content).not.toMatch(/useAccountingAccounts\(activeSlug,\s*activePeriod/);
  });

  it("40. accounting.ts accounts route does NOT call parseDateParam (date filtering not applicable)", () => {
    const content = api("routes/accounting.ts");
    const routeStart = content.indexOf('"/accounting/:slug/accounts"');
    const routeEnd   = content.indexOf('"/accounting/:slug/transactions"', routeStart);
    const block      = content.slice(routeStart, routeEnd);
    // parseDateParam and req.query["from"] must not appear in the accounts route handler
    expect(block).not.toContain("parseDateParam");
    // check specifically for the date-filter code pattern, not the English word "from"
    expect(block).not.toContain('req.query["from"]');
  });
});
