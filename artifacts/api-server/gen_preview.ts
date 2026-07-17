/**
 * Quick preview generator — runs directly in ts-node/tsx.
 * Usage: cd artifacts/api-server && npx tsx /path/to/gen_preview.ts
 *
 * Writes two HTML files:
 *   - preview_single.html  — CarDealer.ai single-entity
 *   - preview_multi.html   — all 4 entities consolidated
 */

import { writeFileSync } from "fs";
import { renderMonthlyClose } from "./src/reports/renderers/monthlyClose";
import type { BuiltReport } from "./src/reports/builder";
import type { ReportTemplate } from "./src/reports/templates";

const TPL: ReportTemplate = {
  id: "monthly-close",
  name: "Monthly Close Report",
  description: "",
  sections: [],
  defaultEntities: "all",
  supportedFormats: ["json", "html", "pdf"],
  enabled: true,
};

function carDealerMetrics(override: Partial<Record<string, unknown>> = {}) {
  return {
    entity: "CarDealer.ai",
    slug: "CarDealer_ai",
    basis: "Accrual",
    as_of: "2026-07-16",
    pipeline_run: "run-001",
    revenue_ytd: 1_380_000,
    cogs_ytd: 552_000,
    gross_profit_ytd: 828_000,
    gross_margin_pct: 60.0,
    opex_ytd: 414_000,
    net_income_ytd: 414_000,
    net_margin_pct: 30.0,
    total_assets: 2_200_000,
    total_liabilities: 800_000,
    total_equity: 1_400_000,
    open_ar: 320_000,
    open_ap: 95_000,
    dso_days: 42,
    dso_days_standard: 38,
    weighted_average_days_overdue: 8,
    dpo_days: 28,
    cash_on_hand: 440_000,
    ar_overdue_pct: 18.5,
    ap_overdue_pct: 3.2,
    ...override,
  };
}

function smileMoreMetrics() {
  return {
    entity: "Smile More",
    slug: "Smile_More",
    basis: "Cash",
    as_of: "2026-07-16",
    pipeline_run: "run-001",
    revenue_ytd: 560_000,
    cogs_ytd: 280_000,
    gross_profit_ytd: 280_000,
    gross_margin_pct: 50.0,
    opex_ytd: 310_000,
    net_income_ytd: -30_000,
    net_margin_pct: -5.36,
    total_assets: 320_000,
    total_liabilities: 110_000,
    total_equity: 210_000,
    open_ar: 42_000,
    open_ap: 18_000,
    dso_days: 22,
    dso_days_standard: null,
    weighted_average_days_overdue: null,
    dpo_days: 18,
    cash_on_hand: -12_500, // legitimate negative — must be preserved
    ar_overdue_pct: 65.0,
    ap_overdue_pct: 0.0,
  };
}

function t3Metrics() {
  return {
    entity: "T3 Marketing",
    slug: "T3_Marketing",
    basis: "Cash",
    as_of: "2026-07-16",
    pipeline_run: "run-001",
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
  };
}

function topMrktrMetrics() {
  return {
    entity: "TopMrktr",
    slug: "TopMrktr",
    basis: "Accrual",
    as_of: "2026-07-16",
    pipeline_run: "run-001",
    revenue_ytd: 720_000,
    cogs_ytd: 216_000,
    gross_profit_ytd: 504_000,
    gross_margin_pct: 70.0,
    opex_ytd: 360_000,
    net_income_ytd: 144_000,
    net_margin_pct: 20.0,
    total_assets: 900_000,
    total_liabilities: 300_000,
    total_equity: 600_000,
    open_ar: 80_000,
    open_ap: 22_000,
    dso_days: 30,
    dso_days_standard: 28,
    weighted_average_days_overdue: 3,
    dpo_days: 20,
    cash_on_hand: 185_000,
    ar_overdue_pct: 12.0,
    ap_overdue_pct: 0.5,
  };
}

function buildFinancials(slug: string, entity: string) {
  return {
    entity_slug: slug,
    as_of: "2026-07-16",
    monthly_pl: [
      { month: "2026-05", revenue: 185_000, cogs: 74_000, gross_profit: 111_000, opex: 55_500, net_income: 55_500 },
      { month: "2026-06", revenue: 195_000, cogs: 78_000, gross_profit: 117_000, opex: 58_500, net_income: 58_500 },
      { month: "2026-07", revenue: 200_000, cogs: 80_000, gross_profit: 120_000, opex: 60_000, net_income: 60_000 },
    ],
    ytd_summary: {
      revenue: 1_380_000,
      cogs: 552_000,
      gross_profit: 828_000,
      opex: 414_000,
      net_income: 414_000,
    },
    balance_sheet: {
      as_of: "2026-07-16",
      assets: { cash: 440_000, accounts_receivable: 320_000, prepaid_expenses: 60_000, equipment_net: 180_000, total: 1_000_000 },
      liabilities: { accounts_payable: 95_000, accrued_liabilities: 45_000, deferred_revenue: 25_000, notes_payable: 85_000, total: 250_000 },
      equity: { paid_in_capital: 250_000, retained_earnings: 500_000, total: 750_000 },
    },
    cash_flow: {
      as_of: "2026-07-16",
      sections: [
        {
          name: "Operating Activities",
          net_cash: 95_000,
          lines: [
            { label: "Beginning Cash", amount: 345_000, is_subtotal: false },
            { label: "Net Income", amount: 60_000, is_subtotal: false },
            { label: "Depreciation & Amortization", amount: 18_000, is_subtotal: false },
            { label: "Changes in Working Capital", amount: 17_000, is_subtotal: false },
          ],
        },
        {
          name: "Investing Activities",
          net_cash: 0,
          lines: [],
        },
        {
          name: "Financing Activities",
          net_cash: -5_000,
          lines: [{ label: "Loan Repayment", amount: -5_000, is_subtotal: false }],
        },
      ],
      net_cash_change: 90_000,
      cash_at_end: 440_000,
    },
  };
}

const commonSections = {
  alerts: [
    {
      entity: "CarDealer.ai",
      title: "AR Aging Above Threshold",
      description: "18.5% of AR (≈$59K) is overdue. Historical average is 12%.",
      severity: "medium",
      recommended_action: "Send aging report to collections team; prioritize top 5 overdue accounts.",
      financial_impact: "$59,200 at risk",
    },
    {
      entity: "Smile More",
      title: "Negative Cash Position",
      description: "Cash on hand is -$12,500. Entity is in a cash deficit as of July 16.",
      severity: "critical",
      recommended_action: "Accelerate AR collection; review discretionary spend; consider short-term credit facility.",
      financial_impact: "-$12,500 cash deficit",
    },
    {
      entity: "Smile More",
      title: "Net Loss for Period",
      description: "YTD net income is -$30,000 (-5.36% margin). Operating expenses exceed revenue.",
      severity: "high",
      recommended_action: "Review OPEX line-by-line for reduction opportunities; target breakeven by Q4.",
      financial_impact: "-$30,000 net loss YTD",
    },
    {
      entity: "T3 Marketing",
      title: "AR Overdue — 30%",
      description: "30% of AR ($45K) is overdue.",
      severity: "low",
      recommended_action: "Send reminders; confirm payment schedules with top 3 delinquent accounts.",
      financial_impact: "$45,000 at risk",
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
};

// ── Single-entity report ──────────────────────────────────────────────────────

const singleReport: BuiltReport = {
  id: "preview-single",
  template: TPL,
  request: { template: "monthly-close", entities: ["CarDealer_ai"], period: "July 2026", format: "html" },
  branding: {
    mode: "single",
    primaryEntity: { slug: "CarDealer_ai", name: "CarDealer.ai", logoPath: null, primaryColor: "#00d4b8" },
    entities: [{ slug: "CarDealer_ai", name: "CarDealer.ai", logoPath: null }],
    financeosBranding: false,
  },
  generatedAt: new Date().toISOString(),
  period: "July 2026",
  source: "cache",
  sections: {
    executive_summary: {},
    portfolio_kpis: { portfolio: null },
    entity_summary: { CarDealer_ai: { metrics: carDealerMetrics(), anomalies: [] } },
    financials: { CarDealer_ai: buildFinancials("CarDealer_ai", "CarDealer.ai") },
    ar_ap: {},
    ...commonSections,
  },
  metadata: { entityCount: 1, dataFreshness: "2026-07-16", confidenceScore: 0.97 },
};

// ── Multi-entity consolidated report ─────────────────────────────────────────

const multiReport: BuiltReport = {
  id: "preview-multi",
  template: TPL,
  request: { template: "monthly-close", entities: "all", period: "July 2026", format: "html" },
  branding: {
    mode: "consolidated",
    entities: [
      { slug: "CarDealer_ai", name: "CarDealer.ai", logoPath: null },
      { slug: "T3_Marketing", name: "T3 Marketing", logoPath: null },
      { slug: "TopMrktr", name: "TopMrktr", logoPath: null },
      { slug: "Smile_More", name: "Smile More", logoPath: null },
    ],
    financeosBranding: true,
  },
  generatedAt: new Date().toISOString(),
  period: "July 2026",
  source: "cache",
  sections: {
    executive_summary: {},
    portfolio_kpis: {
      portfolio: {
        portfolio_revenue_ytd: 3_550_000,
        portfolio_net_income_ytd: 795_000,
        portfolio_net_margin_pct: 22.4,
        portfolio_cash_on_hand: 822_500,
        portfolio_open_ar: 592_000,
        portfolio_open_ap: 180_000,
        cash_runway_months: 6.4,
        pipeline_run: "run-001",
      },
    },
    entity_summary: {
      CarDealer_ai: { metrics: carDealerMetrics(), anomalies: [] },
      T3_Marketing: { metrics: t3Metrics(), anomalies: [] },
      TopMrktr: { metrics: topMrktrMetrics(), anomalies: [] },
      Smile_More: { metrics: smileMoreMetrics(), anomalies: [] },
    },
    financials: {
      CarDealer_ai: buildFinancials("CarDealer_ai", "CarDealer.ai"),
      T3_Marketing: buildFinancials("T3_Marketing", "T3 Marketing"),
      TopMrktr: buildFinancials("TopMrktr", "TopMrktr"),
      Smile_More: buildFinancials("Smile_More", "Smile More"),
    },
    ar_ap: {},
    ...commonSections,
  },
  metadata: { entityCount: 4, dataFreshness: "2026-07-16", confidenceScore: 0.95 },
};

const singleHtml = renderMonthlyClose(singleReport);
const multiHtml = renderMonthlyClose(multiReport);

const scratchDir = "/private/tmp/claude-501/-Users-allisonfabbri/abdec125-ee48-4c92-877e-9a53264327a8/scratchpad";
writeFileSync(`${scratchDir}/preview_single.html`, singleHtml, "utf8");
writeFileSync(`${scratchDir}/preview_multi.html`, multiHtml, "utf8");

console.log("✓ preview_single.html written");
console.log("✓ preview_multi.html written");
