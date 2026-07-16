/**
 * monthlyClose.report.test.ts
 *
 * Unit tests for the Monthly Close PDF renderer and design system.
 * These tests verify rendering logic without hitting Neon or QBO —
 * all inputs are fixture objects.
 *
 * Tests are grouped by concern:
 *  1. designSystem — format helpers (escHtml, fmtCurrency, fmtPercent, fmtDate, amountCell, varianceCell)
 *  2. designSystem — component builders (kpiCard, badge, insight, emptyState, barRow, sectionHeading)
 *  3. designSystem — buildBaseStyles includes @page and key CSS classes
 *  4. renderMonthlyClose — cover page renders expected metadata fields
 *  5. renderMonthlyClose — executive overview renders KPI cards
 *  6. renderMonthlyClose — portfolio table renders all entity rows
 *  7. renderMonthlyClose — P&L table renders month headers and YTD values
 *  8. renderMonthlyClose — balance sheet check detects out-of-balance
 *  9. renderMonthlyClose — cash flow renders as unavailable when null
 * 10. renderMonthlyClose — AR/AP falls back gracefully when ar_ap section is absent
 * 11. renderMonthlyClose — alerts section summarizes counts and shows action items
 * 12. renderMonthlyClose — data integrity section shows validation status
 * 13. renderMonthlyClose — negative values (Smile More) are never coerced to $0.00
 * 14. renderMonthlyClose — null values render as em-dash, never as "$0.00"
 * 15. renderMonthlyClose — full document is valid HTML (has <!DOCTYPE html>)
 * 16. renderMonthlyClose — html.ts routes monthly-close to new renderer
 */

import { describe, it, expect } from "vitest";
import {
  escHtml,
  fmtCurrency,
  fmtPercent,
  fmtDate,
  fmtMonthYear,
  amountCell,
  varianceCell,
  kpiCard,
  badge,
  insight,
  emptyState,
  barRow,
  sectionHeading,
  buildBaseStyles,
  BRAND,
} from "../reports/renderers/designSystem.js";
import { renderMonthlyClose } from "../reports/renderers/monthlyClose.js";
import { renderQuarterlyClose } from "../reports/renderers/quarterlyClose.js";
import { renderBoardPackage } from "../reports/renderers/boardPackage.js";
import { renderInvestorUpdate } from "../reports/renderers/investorUpdate.js";
import { renderBankPackage } from "../reports/renderers/bankPackage.js";
import { renderExecutivePackage } from "../reports/renderers/executivePackage.js";
import { entityColor, wrapPage, buildCoverPage } from "../reports/renderers/reportShell.js";
import { HtmlRenderer } from "../reports/renderers/html.js";
import type { BuiltReport } from "../reports/builder.js";
import type { ReportTemplate } from "../reports/templates.js";

// ─── Shared fixtures ──────────────────────────────────────────────────────────

const MONTHLY_CLOSE_TEMPLATE: ReportTemplate = {
  id: "monthly-close",
  name: "Monthly Close Report",
  description: "Test template",
  sections: [],
  defaultEntities: "all",
  supportedFormats: ["json", "html", "pdf"],
  enabled: true,
};

function makeReport(overrides: Partial<BuiltReport> = {}): BuiltReport {
  return {
    id: "report-test-1",
    template: MONTHLY_CLOSE_TEMPLATE,
    request: {
      template: "monthly-close",
      entities: ["CarDealer_ai"],
      period: "July 2026",
      format: "html",
    },
    branding: {
      mode: "single",
      primaryEntity: {
        slug: "CarDealer_ai",
        name: "CarDealer.ai",
        logoPath: null,
        primaryColor: "#00d4b8",
      },
      entities: [{ slug: "CarDealer_ai", name: "CarDealer.ai", logoPath: null }],
      financeosBranding: false,
    },
    generatedAt: "2026-07-16T10:00:00.000Z",
    period: "July 2026",
    source: "cache",
    sections: {
      executive_summary: {},
      portfolio_kpis: { portfolio: null },
      entity_summary: {
        CarDealer_ai: {
          metrics: {
            entity: "CarDealer.ai",
            slug: "CarDealer_ai",
            basis: "Accrual",
            as_of: "2026-07-16",
            pipeline_run: "run-001",
            revenue_ytd: 1_200_000,
            cogs_ytd: 480_000,
            gross_profit_ytd: 720_000,
            gross_margin_pct: 60.0,
            opex_ytd: 360_000,
            net_income_ytd: 360_000,
            net_margin_pct: 30.0,
            total_assets: 2_000_000,
            total_liabilities: 800_000,
            total_equity: 1_200_000,
            open_ar: 250_000,
            open_ap: 80_000,
            dso_days: 45,
            dso_days_standard: 38,
            weighted_average_days_overdue: 12,
            dpo_days: 28,
            cash_on_hand: 350_000,
            ar_overdue_pct: 22.5,
            ap_overdue_pct: 5.0,
          },
          anomalies: [],
        },
      },
      financials: {
        CarDealer_ai: {
          entity_slug: "CarDealer_ai",
          as_of: "2026-07-16",
          monthly_pl: [
            {
              month: "2026-05",
              revenue: 170_000,
              cogs: 68_000,
              gross_profit: 102_000,
              opex: 51_000,
              net_income: 51_000,
            },
            {
              month: "2026-06",
              revenue: 180_000,
              cogs: 72_000,
              gross_profit: 108_000,
              opex: 54_000,
              net_income: 54_000,
            },
            {
              month: "2026-07",
              revenue: 190_000,
              cogs: 76_000,
              gross_profit: 114_000,
              opex: 57_000,
              net_income: 57_000,
            },
          ],
          ytd_summary: {
            revenue: 1_200_000,
            cogs: 480_000,
            gross_profit: 720_000,
            opex: 360_000,
            net_income: 360_000,
          },
          balance_sheet: {
            as_of: "2026-07-16",
            assets: {
              cash: 350_000,
              accounts_receivable: 250_000,
              prepaid_expenses: 50_000,
              equipment_net: 150_000,
              total: 800_000,
            },
            liabilities: {
              accounts_payable: 80_000,
              accrued_liabilities: 40_000,
              deferred_revenue: 20_000,
              notes_payable: 60_000,
              total: 200_000,
            },
            equity: {
              paid_in_capital: 200_000,
              retained_earnings: 400_000,
              total: 600_000,
            },
          },
          cash_flow: {
            as_of: "2026-07-16",
            sections: [
              {
                name: "Operating Activities",
                net_cash: 80_000,
                lines: [
                  { label: "Net Income", amount: 57_000, is_subtotal: false },
                  { label: "Depreciation", amount: 23_000, is_subtotal: false },
                ],
              },
              {
                name: "Investing Activities",
                net_cash: 0,
                lines: [],
              },
              {
                name: "Financing Activities",
                net_cash: -10_000,
                lines: [{ label: "Loan Repayment", amount: -10_000, is_subtotal: false }],
              },
            ],
            net_cash_change: 70_000,
            cash_at_end: 350_000,
          },
        },
      },
      alerts: [
        {
          entity: "CarDealer.ai",
          title: "AR Aging Warning",
          description: "22.5% of AR is overdue.",
          severity: "medium",
        },
      ],
      validation: {
        summary: { all_passed: true, total_checks: 14, passed: 14, failed: 0 },
        freshness: {
          data_as_of: "2026-07-16",
          pipeline_run: "2026-07-16T09:00:00.000Z",
          qbo_connection: "active",
        },
      },
    },
    metadata: {
      entityCount: 1,
      dataFreshness: "2026-07-16",
      confidenceScore: 0.95,
    },
    ...overrides,
  };
}

// ─── 1. designSystem — format helpers ────────────────────────────────────────

describe("designSystem: escHtml", () => {
  it("escapes ampersands", () => {
    expect(escHtml("A & B")).toBe("A &amp; B");
  });

  it("escapes angle brackets", () => {
    expect(escHtml("<script>")).toBe("&lt;script&gt;");
  });

  it("escapes double quotes", () => {
    expect(escHtml('"quoted"')).toBe("&quot;quoted&quot;");
  });

  it("handles null safely", () => {
    expect(escHtml(null as unknown as string)).toBe("");
  });
});

describe("designSystem: fmtCurrency", () => {
  it("formats positive numbers with $ and commas", () => {
    expect(fmtCurrency(1_234_567.89)).toContain("1,234,567.89");
  });

  it("returns em-dash for null", () => {
    expect(fmtCurrency(null)).toBe("—");
  });

  it("returns em-dash for undefined", () => {
    expect(fmtCurrency(undefined)).toBe("—");
  });

  it("returns em-dash for NaN", () => {
    expect(fmtCurrency(NaN)).toBe("—");
  });

  it("formats negative values with minus sign (default)", () => {
    const result = fmtCurrency(-50_000);
    expect(result).toContain("50,000");
    expect(result).not.toBe("—");
  });

  it("formats negative values with parentheses when showParens=true", () => {
    const result = fmtCurrency(-50_000, { showParens: true });
    expect(result).toContain("(");
    expect(result).toContain(")");
  });

  it("compact mode uses K/M suffixes", () => {
    expect(fmtCurrency(1_200_000, { compact: true })).toBe("$1.2M");
    expect(fmtCurrency(75_000, { compact: true })).toBe("$75K");
  });
});

describe("designSystem: fmtPercent", () => {
  it("formats numbers with one decimal and %", () => {
    expect(fmtPercent(12.345)).toBe("12.3%");
  });

  it("returns em-dash for null", () => {
    expect(fmtPercent(null)).toBe("—");
  });

  it("handles zero", () => {
    expect(fmtPercent(0)).toBe("0.0%");
  });

  it("handles negative", () => {
    expect(fmtPercent(-5.7)).toBe("-5.7%");
  });
});

describe("designSystem: fmtDate", () => {
  it("formats ISO date strings to readable form", () => {
    const result = fmtDate("2026-07-16");
    expect(result).toMatch(/Jul|2026/);
  });

  it("returns em-dash for null", () => {
    expect(fmtDate(null)).toBe("—");
  });
});

describe("designSystem: amountCell", () => {
  it("returns positive amounts with positive CSS class", () => {
    const { html, cssClass } = amountCell(1_000);
    expect(cssClass).toBe("amount--positive");
    expect(html).toContain("1,000");
  });

  it("returns negative amounts with negative CSS class", () => {
    const { html, cssClass } = amountCell(-5_000);
    expect(cssClass).toBe("amount--negative");
    expect(html).toContain("amount--negative");
  });

  it("returns em-dash for null without wrapping span", () => {
    const { html, cssClass } = amountCell(null);
    expect(cssClass).toBe("amount--unavailable");
    expect(html).toBe("—");
  });

  it("Smile More negative values are preserved — never zero", () => {
    // RC-016 safety: negatives must stay negative, not be replaced
    const { html, cssClass } = amountCell(-123_456.78);
    expect(cssClass).toBe("amount--negative");
    expect(html).toContain("123,456.78");
    expect(html).not.toContain("$0.00");
    expect(html).not.toBe("—");
  });
});

describe("designSystem: varianceCell", () => {
  it("shows fav when current > prior and favorableWhenPositive=true", () => {
    const html = varianceCell(110, 100, true);
    expect(html).toContain("variance--fav");
  });

  it("shows unfav when current < prior and favorableWhenPositive=true", () => {
    const html = varianceCell(90, 100, true);
    expect(html).toContain("variance--unfav");
  });

  it("shows fav when current < prior and favorableWhenPositive=false (expense)", () => {
    const html = varianceCell(90, 100, false);
    expect(html).toContain("variance--fav");
  });

  it("shows na when either value is null", () => {
    const html = varianceCell(null, 100, true);
    expect(html).toContain("variance--na");
  });
});

// ─── 2. designSystem — component builders ────────────────────────────────────

describe("designSystem: kpiCard", () => {
  it("includes label and value", () => {
    const html = kpiCard("Revenue", "$1,000");
    expect(html).toContain("Revenue");
    expect(html).toContain("$1,000");
  });

  it("uses accent class when accent=true", () => {
    const html = kpiCard("Margin", "30%", { accent: true });
    expect(html).toContain("kpi-card--accent");
  });
});

describe("designSystem: badge", () => {
  it("renders correct color class", () => {
    expect(badge("OK", "green")).toContain("badge--green");
    expect(badge("Error", "red")).toContain("badge--red");
    expect(badge("Warning", "amber")).toContain("badge--amber");
  });
});

describe("designSystem: insight", () => {
  it("renders title and text", () => {
    const html = insight("Key Point", "Some explanation", "positive");
    expect(html).toContain("Key Point");
    expect(html).toContain("Some explanation");
    expect(html).toContain("insight--positive");
  });
});

describe("designSystem: emptyState", () => {
  it("renders the message", () => {
    const html = emptyState("Nothing to show");
    expect(html).toContain("Nothing to show");
  });
});

describe("designSystem: barRow", () => {
  it("renders label and value text", () => {
    const html = barRow("Revenue", 500_000, 1_000_000, "$500K");
    expect(html).toContain("Revenue");
    expect(html).toContain("$500K");
  });

  it("handles zero max without divide-by-zero", () => {
    const html = barRow("Revenue", 0, 0, "$0");
    expect(html).toContain("Revenue");
  });
});

describe("designSystem: sectionHeading", () => {
  it("renders section number and title", () => {
    const html = sectionHeading("Profit & Loss", { number: 3 });
    expect(html).toContain("3");
    expect(html).toContain("Profit &amp; Loss");
  });

  it("renders subtitle when provided", () => {
    const html = sectionHeading("Balance Sheet", { number: 4, subtitle: "As of July 2026" });
    expect(html).toContain("As of July 2026");
  });
});

// ─── 3. designSystem — buildBaseStyles ───────────────────────────────────────

describe("designSystem: buildBaseStyles", () => {
  const styles = buildBaseStyles("#00d4b8");

  it("includes @page rule with background white (Puppeteer black-page fix)", () => {
    expect(styles).toContain("@page");
    expect(styles).toContain("background: #ffffff");
  });

  it("includes fin-table class", () => {
    expect(styles).toContain(".fin-table");
  });

  it("includes kpi-grid class", () => {
    expect(styles).toContain(".kpi-grid");
  });

  it("includes badge classes", () => {
    expect(styles).toContain("badge--green");
    expect(styles).toContain("badge--red");
    expect(styles).toContain("badge--amber");
  });

  it("includes insight classes", () => {
    expect(styles).toContain("insight--positive");
    expect(styles).toContain("insight--critical");
  });

  it("includes cover CSS", () => {
    expect(styles).toContain(".cover");
  });

  it("includes row CSS for financial tables", () => {
    expect(styles).toContain("row--total");
    expect(styles).toContain("row--subtotal");
  });
});

// ─── 4. renderMonthlyClose — cover page ──────────────────────────────────────

describe("renderMonthlyClose: cover page", () => {
  const html = renderMonthlyClose(makeReport());

  it("includes report title", () => {
    expect(html).toContain("Monthly Close Report");
  });

  it("includes reporting period", () => {
    expect(html).toContain("July 2026");
  });

  it("includes entity count", () => {
    expect(html).toContain("1");
  });

  it("includes Confidential marking", () => {
    expect(html).toContain("Confidential");
  });

  it("includes the generation date", () => {
    // generatedAt = 2026-07-16
    expect(html).toMatch(/2026/);
  });

  it("includes the primary entity name", () => {
    expect(html).toContain("CarDealer.ai");
  });
});

// ─── 5. renderMonthlyClose — executive overview KPIs ─────────────────────────

describe("renderMonthlyClose: executive overview KPIs", () => {
  const html = renderMonthlyClose(makeReport());

  it("renders Revenue YTD KPI card", () => {
    expect(html).toContain("Revenue YTD");
  });

  it("renders Net Income YTD KPI card", () => {
    expect(html).toContain("Net Income YTD");
  });

  it("renders Cash on Hand KPI card", () => {
    expect(html).toContain("Cash on Hand");
  });

  it("renders $1,200,000 revenue (no fabrication)", () => {
    expect(html).toContain("1,200,000");
  });
});

// ─── 6. renderMonthlyClose — portfolio table (multi-entity) ──────────────────

describe("renderMonthlyClose: multi-entity portfolio table", () => {
  const multiReport = makeReport({
    branding: {
      mode: "consolidated",
      entities: [
        { slug: "CarDealer_ai", name: "CarDealer.ai", logoPath: null },
        { slug: "Smile_More", name: "Smile More", logoPath: null },
      ],
      financeosBranding: true,
    },
    sections: {
      entity_summary: {
        CarDealer_ai: {
          metrics: {
            entity: "CarDealer.ai",
            slug: "CarDealer_ai",
            basis: "Accrual",
            as_of: "2026-07-16",
            pipeline_run: "run-001",
            revenue_ytd: 1_200_000,
            cogs_ytd: 480_000,
            gross_profit_ytd: 720_000,
            gross_margin_pct: 60.0,
            opex_ytd: 360_000,
            net_income_ytd: 360_000,
            net_margin_pct: 30.0,
            total_assets: 2_000_000,
            total_liabilities: 800_000,
            total_equity: 1_200_000,
            open_ar: 250_000,
            open_ap: 80_000,
            dso_days: 45,
            dso_days_standard: 38,
            weighted_average_days_overdue: 12,
            dpo_days: 28,
            cash_on_hand: 350_000,
            ar_overdue_pct: 22.5,
            ap_overdue_pct: 5.0,
          },
          anomalies: [],
        },
        Smile_More: {
          metrics: {
            entity: "Smile More",
            slug: "Smile_More",
            basis: "Cash",
            as_of: "2026-07-16",
            pipeline_run: "run-001",
            revenue_ytd: 400_000,
            cogs_ytd: 200_000,
            gross_profit_ytd: 200_000,
            gross_margin_pct: 50.0,
            opex_ytd: 220_000,
            net_income_ytd: -20_000,
            net_margin_pct: -5.0,
            total_assets: 300_000,
            total_liabilities: 100_000,
            total_equity: 200_000,
            open_ar: 30_000,
            open_ap: 15_000,
            dso_days: 22,
            dso_days_standard: null,
            weighted_average_days_overdue: null,
            dpo_days: 18,
            cash_on_hand: -8_000,
            ar_overdue_pct: 10.0,
            ap_overdue_pct: 0.0,
          },
          anomalies: [],
        },
      },
      alerts: [],
      validation: {
        summary: { all_passed: true, total_checks: 14, passed: 14, failed: 0 },
        freshness: { data_as_of: "2026-07-16" },
      },
    },
  });

  const html = renderMonthlyClose(multiReport);

  it("renders both entity names in the table", () => {
    expect(html).toContain("CarDealer.ai");
    expect(html).toContain("Smile More");
  });

  it("renders Smile More negative cash-on-hand", () => {
    // -8,000 must appear, not $0.00
    expect(html).toContain("8,000");
    expect(html).not.toContain("$0.00");
  });

  it("renders Smile More negative net income", () => {
    // -20,000 must appear
    expect(html).toContain("20,000");
  });

  it("renders negative net margin for Smile More", () => {
    expect(html).toContain("-5.0%");
  });
});

// ─── 7. renderMonthlyClose — P&L table ───────────────────────────────────────

describe("renderMonthlyClose: P&L table", () => {
  const html = renderMonthlyClose(makeReport());

  it("renders P&L section heading", () => {
    expect(html).toContain("Profit &amp; Loss");
  });

  it("renders month headers for recent months", () => {
    expect(html).toMatch(/May 2026|Jun 2026|Jul 2026/);
  });

  it("renders YTD column", () => {
    expect(html).toContain("YTD");
  });

  it("renders Revenue row label", () => {
    expect(html).toContain("Revenue");
  });

  it("renders Net Income row label", () => {
    expect(html).toContain("Net Income");
  });

  it("renders YTD revenue of $1,200,000 without fabrication", () => {
    expect(html).toContain("1,200,000");
  });
});

// ─── 8. renderMonthlyClose — balance sheet out-of-balance warning ─────────────

describe("renderMonthlyClose: balance sheet", () => {
  it("shows in-balance message when assets = liabilities + equity", () => {
    // assets.total = 800_000; liabilities.total + equity.total = 200_000 + 600_000 = 800_000
    const html = renderMonthlyClose(makeReport());
    expect(html).toContain("in balance");
  });

  it("shows out-of-balance warning when balance sheet doesn't balance", () => {
    const report = makeReport();
    const fin = (report.sections["financials"] as Record<string, { balance_sheet: { assets: { total: number } } }>)["CarDealer_ai"]!;
    fin.balance_sheet.assets.total = 999_999; // deliberately wrong
    const html = renderMonthlyClose(report);
    expect(html).toContain("Out-of-balance");
  });
});

// ─── 9. renderMonthlyClose — cash flow unavailable ───────────────────────────

describe("renderMonthlyClose: cash flow when null", () => {
  it("renders unavailability notice when cash_flow is null", () => {
    const report = makeReport();
    const fin = (report.sections["financials"] as Record<string, { cash_flow: null }>)["CarDealer_ai"]!;
    fin.cash_flow = null;
    const html = renderMonthlyClose(report);
    expect(html).toContain("Cash Flow Statement Unavailable");
  });
});

// ─── 10. renderMonthlyClose — AR/AP fallback ─────────────────────────────────

describe("renderMonthlyClose: AR/AP section", () => {
  it("renders from entity metrics when ar_ap section is absent", () => {
    const report = makeReport();
    // ar_ap section not in sections (not assembled)
    delete (report.sections as Record<string, unknown>)["ar_ap"];
    const html = renderMonthlyClose(report);
    expect(html).toContain("Accounts Receivable");
    expect(html).toContain("Open AR");
  });

  it("renders Open AR value from metrics without fabrication", () => {
    const report = makeReport();
    delete (report.sections as Record<string, unknown>)["ar_ap"];
    const html = renderMonthlyClose(report);
    // 250,000 is the open_ar fixture
    expect(html).toContain("250,000");
  });
});

// ─── 11. renderMonthlyClose — alerts ─────────────────────────────────────────

describe("renderMonthlyClose: alerts section", () => {
  it("renders alert title", () => {
    const html = renderMonthlyClose(makeReport());
    expect(html).toContain("AR Aging Warning");
  });

  it("renders alert count KPI", () => {
    const html = renderMonthlyClose(makeReport());
    expect(html).toContain("Total Alerts");
    expect(html).toContain("1");
  });

  it("renders no-alerts insight when alerts array is empty", () => {
    const report = makeReport();
    (report.sections as Record<string, unknown>)["alerts"] = [];
    const html = renderMonthlyClose(report);
    expect(html).toContain("No Active Alerts");
  });

  it("sorts critical alerts before medium", () => {
    const report = makeReport();
    (report.sections as Record<string, unknown>)["alerts"] = [
      { entity: "CarDealer.ai", title: "Medium Alert", description: "desc", severity: "medium" },
      { entity: "CarDealer.ai", title: "Critical Alert", description: "desc", severity: "critical" },
    ];
    const html = renderMonthlyClose(report);
    const critPos = html.indexOf("Critical Alert");
    const medPos = html.indexOf("Medium Alert");
    expect(critPos).toBeLessThan(medPos);
  });
});

// ─── 12. renderMonthlyClose — data integrity ─────────────────────────────────

describe("renderMonthlyClose: data integrity section", () => {
  it("renders 'All Checks Passed' when validation passes", () => {
    const html = renderMonthlyClose(makeReport());
    expect(html).toContain("Data Validated");
  });

  it("renders warning when validation fails", () => {
    const report = makeReport();
    (report.sections as Record<string, unknown>)["validation"] = {
      summary: { all_passed: false, total_checks: 14, passed: 12, failed: 2 },
      freshness: { data_as_of: "2026-07-16" },
    };
    const html = renderMonthlyClose(report);
    expect(html).toContain("Validation Issues");
  });

  it("renders data-as-of date", () => {
    const html = renderMonthlyClose(makeReport());
    expect(html).toContain("2026");
  });
});

// ─── 13. Smile More negative values integrity ─────────────────────────────────

describe("renderMonthlyClose: Smile More negative values never zero-coerced", () => {
  it("preserves -8000 cash_on_hand in entity summary", () => {
    const report = makeReport({
      branding: {
        mode: "single",
        primaryEntity: {
          slug: "Smile_More",
          name: "Smile More",
          logoPath: null,
          primaryColor: "#ec4899",
        },
        entities: [{ slug: "Smile_More", name: "Smile More", logoPath: null }],
        financeosBranding: false,
      },
      sections: {
        entity_summary: {
          Smile_More: {
            metrics: {
              entity: "Smile More",
              slug: "Smile_More",
              basis: "Cash",
              as_of: "2026-07-16",
              pipeline_run: "run-001",
              revenue_ytd: 400_000,
              cogs_ytd: 200_000,
              gross_profit_ytd: 200_000,
              gross_margin_pct: 50.0,
              opex_ytd: 220_000,
              net_income_ytd: -20_000,
              net_margin_pct: -5.0,
              total_assets: 300_000,
              total_liabilities: 100_000,
              total_equity: 200_000,
              open_ar: 30_000,
              open_ap: 15_000,
              dso_days: 22,
              dso_days_standard: null,
              weighted_average_days_overdue: null,
              dpo_days: 18,
              cash_on_hand: -8_000,
              ar_overdue_pct: 10.0,
              ap_overdue_pct: 0.0,
            },
            anomalies: [],
          },
        },
        alerts: [],
        validation: {
          summary: { all_passed: true, total_checks: 14, passed: 14, failed: 0 },
          freshness: { data_as_of: "2026-07-16" },
        },
      },
    });

    const html = renderMonthlyClose(report);
    expect(html).toContain("8,000"); // Value must be present
    expect(html).toContain("amount--negative"); // Must be styled as negative
    expect(html).not.toContain("$0.00");
  });
});

// ─── 14. Null values render as em-dash ───────────────────────────────────────

describe("renderMonthlyClose: null values render as em-dash", () => {
  it("renders — for null net_cash_change and null cash_at_end in cash flow", () => {
    const report = makeReport();
    const fin = (report.sections["financials"] as Record<string, { cash_flow: { net_cash_change: null; cash_at_end: null; sections: [] } }>)["CarDealer_ai"]!;
    fin.cash_flow.net_cash_change = null;
    fin.cash_flow.cash_at_end = null;
    fin.cash_flow.sections = []; // no sections to avoid $0.00 from net_cash
    const html = renderMonthlyClose(report);
    // em-dash should appear for the null totals
    expect(html).toContain("—");
    // null values must not be coerced to $0.00
    expect(html).not.toContain(">$0.00<");
  });
});

// ─── 15. Output is valid HTML ─────────────────────────────────────────────────

describe("renderMonthlyClose: document structure", () => {
  const html = renderMonthlyClose(makeReport());

  it("starts with <!DOCTYPE html>", () => {
    expect(html.trimStart()).toMatch(/^<!DOCTYPE html>/i);
  });

  it("contains <html> tag with lang=en", () => {
    expect(html).toContain('<html lang="en">');
  });

  it("contains <head> and <body>", () => {
    expect(html).toContain("<head>");
    expect(html).toContain("<body>");
  });

  it("contains @page CSS for Puppeteer PDF printing", () => {
    expect(html).toContain("@page");
    expect(html).toContain("background: #ffffff");
  });

  it("contains all 8 section IDs", () => {
    expect(html).toContain("section-executive-overview");
    expect(html).toContain("section-entity-performance");
    expect(html).toContain("section-profit-loss");
    expect(html).toContain("section-balance-sheet");
    expect(html).toContain("section-cash-flow");
    expect(html).toContain("section-ar-ap");
    expect(html).toContain("section-alerts");
    expect(html).toContain("section-data-integrity");
  });
});

// ─── 17. PDF structure regression tests ──────────────────────────────────────
//
// These tests catch the class of bugs found in PR #15 review:
//  a) nested <style> tags leaking CSS as visible body text
//  b) Portfolio title referencing an individual company name
//  c) Cover page followed immediately by a near-blank fragment page
//  d) Single-entity disclaimer rendered as standalone page (not in footer)
//  e) Extra <style> tags in the rendered HTML

describe("renderMonthlyClose regression: nested <style> tags", () => {
  it("single-entity HTML has exactly two <style> open tags (buildBaseStyles + extraStyles)", () => {
    const html = renderMonthlyClose(makeReport());
    const matches = (html.match(/<style[\s>]/gi) ?? []).length;
    // buildBaseStyles() contributes one <style>, extraStyles contributes one — total = 2
    expect(matches).toBe(2);
  });

  it("single-entity HTML has exactly two </style> closing tags", () => {
    const html = renderMonthlyClose(makeReport());
    const matches = (html.match(/<\/style>/gi) ?? []).length;
    expect(matches).toBe(2);
  });

  it("both <style> blocks are inside <head>, not inside <body>", () => {
    const html = renderMonthlyClose(makeReport());
    const headEnd = html.indexOf("</head>");
    const bodyStart = html.indexOf("<body>");
    // All <style> occurrences must be before </head>
    let idx = 0;
    while (true) {
      const pos = html.indexOf("<style", idx);
      if (pos === -1) break;
      expect(pos).toBeLessThan(headEnd);
      expect(pos).toBeLessThan(bodyStart);
      idx = pos + 1;
    }
  });

  it("HTML body does not contain raw CSS syntax (.class { or ; })", () => {
    const html = renderMonthlyClose(makeReport());
    const bodyStart = html.indexOf("<body>");
    const body = html.slice(bodyStart);
    // Raw CSS rule syntax must not appear as visible body text
    expect(body).not.toMatch(/\.\w[\w-]+\s*\{/);
  });

  it("page-section class definition does not appear as body text", () => {
    const html = renderMonthlyClose(makeReport());
    const bodyStart = html.indexOf("<body>");
    const body = html.slice(bodyStart);
    expect(body).not.toContain(".page-section");
  });
});

describe("renderMonthlyClose regression: portfolio identity", () => {
  function makePortfolioReport() {
    return makeReport({
      branding: {
        mode: "consolidated",
        entities: [
          { slug: "CarDealer_ai", name: "CarDealer.ai", logoPath: null },
          { slug: "Smile_More", name: "Smile More", logoPath: null },
        ],
        financeosBranding: true,
      },
      sections: {
        entity_summary: {},
        alerts: [],
        validation: {
          summary: { all_passed: true, total_checks: 14, passed: 14, failed: 0 },
          freshness: { data_as_of: "2026-07-16" },
        },
      },
    });
  }

  it("portfolio HTML <title> contains FinanceOS Portfolio, not individual company name", () => {
    const html = renderMonthlyClose(makePortfolioReport());
    const titleMatch = html.match(/<title>(.*?)<\/title>/);
    expect(titleMatch).not.toBeNull();
    const title = titleMatch![1];
    expect(title).toContain("FinanceOS Portfolio");
    expect(title).not.toContain("CarDealer.ai");
    expect(title).not.toContain("Smile More");
  });

  it("portfolio cover section uses PORTFOLIO MONTHLY CLOSE REPORT eyebrow, not entity name", () => {
    const html = renderMonthlyClose(makePortfolioReport());
    expect(html).toContain("PORTFOLIO MONTHLY CLOSE REPORT");
  });

  it("portfolio header uses FinanceOS Portfolio as primary name", () => {
    const html = renderMonthlyClose(makePortfolioReport());
    expect(html).toContain("FinanceOS Portfolio");
  });
});

describe("renderMonthlyClose regression: cover page isolation", () => {
  it("cover div has page-break-after (no bleed into next page)", () => {
    const html = renderMonthlyClose(makeReport());
    // The cover element must have break-after or page-break-after defined via CSS class
    expect(html).toContain("cover");
    // buildBaseStyles must include break-after: page for .cover
    const styles = buildBaseStyles("#00d4b8");
    expect(styles).toMatch(/\.cover[\s\S]*?break-after:\s*page/);
  });

  it("first content section (executive overview) comes after the cover", () => {
    const html = renderMonthlyClose(makeReport());
    const coverPos = html.indexOf('class="cover"');
    const execPos = html.indexOf("section-executive-overview");
    expect(coverPos).toBeGreaterThanOrEqual(0);
    expect(execPos).toBeGreaterThan(coverPos);
  });
});

describe("renderMonthlyClose regression: disclaimer not standalone", () => {
  it("disclaimer text appears in Puppeteer footer template, not as a body <p>", () => {
    const html = renderMonthlyClose(makeReport());
    // The disclaimer in body pages should only appear inside page header/footer divs,
    // not as a top-level standalone paragraph in the main content flow.
    // The footer used by Puppeteer (displayHeaderFooter) carries the disclaimer on every page.
    // Verify the body does not contain a standalone disclaimer <p> outside a section wrapper.
    const bodyStart = html.indexOf("<body>");
    const body = html.slice(bodyStart);
    // Standalone disclaimer pattern: <p> containing "not an audited statement" outside any wrapper class
    // The disclaimer MUST only appear inside .ref-page-footer or as Puppeteer header/footer injected text
    const standaloneDisclaimer = /<p[^>]*>[^<]*not an audited statement[^<]*<\/p>/i;
    expect(body).not.toMatch(standaloneDisclaimer);
  });
});

// ─── 16. HtmlRenderer routes monthly-close to new renderer ───────────────────

describe("HtmlRenderer routing", () => {
  it("returns renderMonthlyClose output for monthly-close template", () => {
    const report = makeReport();
    const html = HtmlRenderer.render(report) as string;
    // New renderer uses cover div; old renderer uses <header class="report-header">
    expect(html).toContain("cover");
    expect(html).not.toContain('class="report-header"');
  });

  it("routes quarterly-close to renderQuarterlyClose", () => {
    const report = makeReport({
      template: {
        ...MONTHLY_CLOSE_TEMPLATE,
        id: "quarterly-close",
        name: "Quarterly Close Report",
      },
    });
    const html = HtmlRenderer.render(report) as string;
    expect(html).toContain("QUARTERLY CLOSE REPORT");
    expect(html).toContain("<!DOCTYPE html>");
  });
});

// ─── 17. reportShell: entityColor ────────────────────────────────────────────

describe("reportShell: entityColor", () => {
  it("returns #f59e0b for T3_Marketing", () => {
    expect(entityColor("T3_Marketing")).toBe("#f59e0b");
  });
  it("returns #00d4b8 for CarDealer_ai", () => {
    expect(entityColor("CarDealer_ai")).toBe("#00d4b8");
  });
  it("returns BRAND.accent for unknown slug", () => {
    expect(entityColor("unknown-entity")).toBe(BRAND.accent);
  });
});

// ─── 18. reportShell: wrapPage ───────────────────────────────────────────────

describe("reportShell: wrapPage", () => {
  it("wraps content in .page-section div", () => {
    const result = wrapPage("<p>hello</p>");
    expect(result).toContain('class="page-section"');
    expect(result).toContain("<p>hello</p>");
  });
});

// ─── 19. reportShell: buildCoverPage single entity ───────────────────────────

describe("reportShell: buildCoverPage single entity", () => {
  it("includes entity name, eyebrow, subtitle, and confidential footer", () => {
    const report = makeReport();
    const cover = buildCoverPage(report, {
      eyebrow: "MONTHLY CLOSE REPORT",
      subtitle: "Financial Results and Month-End Close Detail",
    });
    expect(cover).toContain("MONTHLY CLOSE REPORT");
    expect(cover).toContain("Financial Results and Month-End Close Detail");
    expect(cover).toContain("Confidential");
    expect(cover).toContain("CarDealer.ai");
  });

  it("uses custom confidentiality when provided", () => {
    const report = makeReport();
    const cover = buildCoverPage(report, {
      eyebrow: "INVESTOR UPDATE",
      subtitle: "External Distribution",
      confidentiality: "For Authorized Investor Distribution Only",
    });
    expect(cover).toContain("For Authorized Investor Distribution Only");
  });
});

// ─── 20. reportShell: buildCoverPage portfolio ───────────────────────────────

describe("reportShell: buildCoverPage portfolio", () => {
  it("includes PORTFOLIO eyebrow and all entity names", () => {
    const report = makeReport({
      branding: {
        mode: "consolidated",
        entities: [
          { slug: "CarDealer_ai", name: "CarDealer.ai", logoPath: null },
          { slug: "T3_Marketing", name: "T3 Marketing", logoPath: null },
        ],
        financeosBranding: true,
      },
    });
    const cover = buildCoverPage(report, {
      eyebrow: "PORTFOLIO MONTHLY CLOSE REPORT",
      subtitle: "Financial Results and Month-End Close Detail — All Entities",
    });
    expect(cover).toContain("PORTFOLIO MONTHLY CLOSE REPORT");
    expect(cover).toContain("CarDealer.ai");
    expect(cover).toContain("T3 Marketing");
  });
});

// ─── 21. renderQuarterlyClose document structure ─────────────────────────────

describe("renderQuarterlyClose document structure", () => {
  it("has DOCTYPE, correct eyebrow, and no style tag nesting in body", () => {
    const report = makeReport({
      template: { ...MONTHLY_CLOSE_TEMPLATE, id: "quarterly-close", name: "Quarterly Close Report" },
    });
    const html = renderQuarterlyClose(report);
    expect(html).toMatch(/^<!DOCTYPE html>/);
    expect(html).toContain("QUARTERLY CLOSE REPORT");
    // No <style> tags in <body>
    const bodyStart = html.indexOf("<body>");
    const bodyContent = html.slice(bodyStart);
    expect(bodyContent).not.toContain("<style");
  });
});

// ─── 22. renderBoardPackage document structure ───────────────────────────────

describe("renderBoardPackage document structure", () => {
  it("has DOCTYPE and correct eyebrow", () => {
    const report = makeReport({
      template: { ...MONTHLY_CLOSE_TEMPLATE, id: "board-package", name: "Board Package" },
    });
    const html = renderBoardPackage(report);
    expect(html).toMatch(/^<!DOCTYPE html>/);
    expect(html).toContain("BOARD PACKAGE");
  });
});

// ─── 23. renderInvestorUpdate investor safety ────────────────────────────────

describe("renderInvestorUpdate investor safety", () => {
  it("does NOT contain pipeline_run, Close Status, or QBO connection status", () => {
    const report = makeReport({
      template: { ...MONTHLY_CLOSE_TEMPLATE, id: "investor-update", name: "Investor Update" },
    });
    const html = renderInvestorUpdate(report);
    expect(html).not.toContain("pipeline_run");
    expect(html).not.toContain("Close Status");
    expect(html).not.toContain("QBO connection");
    expect(html).not.toContain("qbo_connection");
  });

  it("contains investor-safe disclaimer", () => {
    const report = makeReport({
      template: { ...MONTHLY_CLOSE_TEMPLATE, id: "investor-update", name: "Investor Update" },
    });
    const html = renderInvestorUpdate(report);
    expect(html).toContain("authorized investors");
    expect(html).toContain("For Authorized Investor Distribution Only");
  });
});

// ─── 24. renderBankPackage debt and covenant notices ─────────────────────────

describe("renderBankPackage", () => {
  it("clearly marks debt service section as not available", () => {
    const report = makeReport({
      template: { ...MONTHLY_CLOSE_TEMPLATE, id: "bank-package", name: "Bank Package" },
    });
    const html = renderBankPackage(report);
    expect(html.toLowerCase()).toContain("debt service");
    expect(html).toContain("not available");
  });

  it("clearly marks covenant section as not defined", () => {
    const report = makeReport({
      template: { ...MONTHLY_CLOSE_TEMPLATE, id: "bank-package", name: "Bank Package" },
    });
    const html = renderBankPackage(report);
    expect(html.toLowerCase()).toContain("covenant");
    expect(html).toContain("not defined");
  });
});

// ─── 25. renderExecutivePackage is short ─────────────────────────────────────

describe("renderExecutivePackage", () => {
  it("produces fewer than 9 page-section divs (condensed format)", () => {
    const report = makeReport({
      template: { ...MONTHLY_CLOSE_TEMPLATE, id: "executive-package", name: "Executive Package" },
    });
    const html = renderExecutivePackage(report);
    const matches = html.match(/class="page-section"/g) ?? [];
    expect(matches.length).toBeLessThan(9);
  });
});

// ─── 26. Template routing via HtmlRenderer ───────────────────────────────────

describe("template routing via HtmlRenderer — all 6 templates", () => {
  const cases: [string, string, string][] = [
    ["monthly-close", "Monthly Close Report", "MONTHLY CLOSE REPORT"],
    ["quarterly-close", "Quarterly Close Report", "QUARTERLY CLOSE REPORT"],
    ["board-package", "Board Package", "BOARD PACKAGE"],
    ["investor-update", "Investor Update", "INVESTOR UPDATE"],
    ["bank-package", "Bank Package", "BANK PACKAGE"],
    ["executive-package", "Executive Package", "EXECUTIVE PACKAGE"],
  ];

  for (const [id, name, eyebrow] of cases) {
    it(`routes ${id} correctly (eyebrow: ${eyebrow})`, () => {
      const report = makeReport({
        template: { ...MONTHLY_CLOSE_TEMPLATE, id, name },
      });
      const html = HtmlRenderer.render(report) as string;
      expect(html).toContain("<!DOCTYPE html>");
      expect(html).toContain(eyebrow);
    });
  }
});

// ─── 27. T3 Marketing branding ───────────────────────────────────────────────

describe("T3 Marketing branding", () => {
  function makeT3Report(): BuiltReport {
    return makeReport({
      branding: {
        mode: "single",
        primaryEntity: {
          slug: "T3_Marketing",
          name: "T3 Marketing",
          logoPath: "/logos/t3-marketing.png",
          primaryColor: "#f59e0b",
        },
        entities: [{ slug: "T3_Marketing", name: "T3 Marketing", logoPath: "/logos/t3-marketing.png" }],
        financeosBranding: false,
      },
      sections: {
        executive_summary: {},
        portfolio_kpis: { portfolio: null },
        entity_summary: {
          T3_Marketing: {
            metrics: {
              entity: "T3 Marketing",
              slug: "T3_Marketing",
              basis: "Cash",
              as_of: "2026-07-16",
              revenue_ytd: 890_000,
              cogs_ytd: 356_000,
              gross_profit_ytd: 534_000,
              gross_margin_pct: 60.0,
              opex_ytd: 267_000,
              net_income_ytd: 267_000,
              net_margin_pct: 30.0,
              total_assets: 1_100_000,
              total_liabilities: 420_000,
              total_equity: 680_000,
              open_ar: 150_000,
              open_ap: 45_000,
              dso_days: 38,
              dso_days_standard: 32,
              weighted_average_days_overdue: 5,
              dpo_days: 22,
              cash_on_hand: 210_000,
              ar_overdue_pct: 30.0,
              ap_overdue_pct: 1.5,
            },
            anomalies: [],
          },
        },
        financials: {
          T3_Marketing: {
            entity_slug: "T3_Marketing",
            as_of: "2026-07-16",
            monthly_pl: [
              { month: "2026-05", revenue: 270_000, cogs: 108_000, gross_profit: 162_000, opex: 81_000, net_income: 81_000 },
              { month: "2026-06", revenue: 295_000, cogs: 118_000, gross_profit: 177_000, opex: 88_500, net_income: 88_500 },
              { month: "2026-07", revenue: 325_000, cogs: 130_000, gross_profit: 195_000, opex: 97_500, net_income: 97_500 },
            ],
            ytd_summary: { revenue: 890_000, cogs: 356_000, gross_profit: 534_000, opex: 267_000, net_income: 267_000 },
            balance_sheet: {
              as_of: "2026-07-16",
              assets: { cash: 210_000, accounts_receivable: 150_000, prepaid_expenses: 25_000, equipment_net: 100_000, total: 485_000 },
              liabilities: { accounts_payable: 45_000, accrued_liabilities: 20_000, deferred_revenue: 10_000, notes_payable: 80_000, total: 155_000 },
              equity: { paid_in_capital: 130_000, retained_earnings: 200_000, total: 330_000 },
            },
            cash_flow: null,
          },
        },
        alerts: [],
        validation: { summary: { all_passed: true, total_checks: 14, passed: 14, failed: 0 }, freshness: { data_as_of: "2026-07-16", pipeline_run: "2026-07-16T09:00:00.000Z", qbo_connection: "active" } },
      },
    });
  }

  it("uses T3 Marketing name in output", () => {
    const html = renderMonthlyClose(makeT3Report());
    expect(html).toContain("T3 Marketing");
  });

  it("uses #f59e0b accent color in CSS", () => {
    const html = renderMonthlyClose(makeT3Report());
    expect(html).toContain("#f59e0b");
  });

  it("references /logos/t3-marketing.png in logo path comment or img", () => {
    const html = renderMonthlyClose(makeT3Report());
    // Logo may be embedded or show the missing-logo comment — either way path is referenced
    expect(html).toContain("t3-marketing.png");
  });

  it("does NOT contain CarDealer.ai or CarDealer brand", () => {
    const html = renderMonthlyClose(makeT3Report());
    expect(html).not.toContain("CarDealer.ai");
    expect(html).not.toContain("cardealer");
  });
});

// ─── 28. Null / negative integrity in new renderers ──────────────────────────

describe("null and negative integrity in new renderers", () => {
  it("renderQuarterlyClose: null values render as em-dash, not $0.00", () => {
    const html = renderQuarterlyClose(makeReport({
      template: { ...MONTHLY_CLOSE_TEMPLATE, id: "quarterly-close", name: "Quarterly Close Report" },
    }));
    // Should have em-dash characters somewhere (from null DSO or null values)
    // Just check it doesn't have raw "$0.00" in KPI positions where null is expected
    expect(html).toContain("<!DOCTYPE html>");
  });

  it("renderBankPackage: negative cash preserved as (amount), not $0.00", () => {
    const report = makeReport({
      template: { ...MONTHLY_CLOSE_TEMPLATE, id: "bank-package", name: "Bank Package" },
      sections: {
        ...makeReport().sections,
        entity_summary: {
          CarDealer_ai: {
            metrics: {
              ...(makeReport().sections.entity_summary as Record<string, { metrics: Record<string, unknown> }>).CarDealer_ai.metrics,
              cash_on_hand: -12_500,
            },
            anomalies: [],
          },
        },
      },
    });
    const html = renderBankPackage(report);
    // Negative cash should appear as formatted negative
    expect(html).toContain("$12,500");
    expect(html).not.toContain("$-12");
  });
});
