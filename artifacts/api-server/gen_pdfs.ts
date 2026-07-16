/**
 * PDF generation script — 3 reports × (PDF + per-section PNG).
 * Usage: cd artifacts/api-server && npx tsx gen_pdfs.ts
 *
 * Outputs:
 *   out/pdf/monthly-close-cardealer-single.pdf
 *   out/pdf/monthly-close-portfolio-all.pdf
 *   out/pdf/monthly-close-smile-more-single.pdf
 *   out/png/<slug>/page-XX.png
 */

import puppeteer from "puppeteer";
import { mkdirSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { renderMonthlyClose } from "./src/reports/renderers/monthlyClose";
import type { BuiltReport } from "./src/reports/builder";
import type { ReportTemplate } from "./src/reports/templates";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

const OUT_DIR = resolve(__dirname, "out");
const PDF_DIR = resolve(OUT_DIR, "pdf");
const PNG_DIR = resolve(OUT_DIR, "png");
[PDF_DIR, PNG_DIR].forEach((d) => mkdirSync(d, { recursive: true }));

const TPL: ReportTemplate = {
  id: "monthly-close",
  name: "Monthly Close Report",
  description: "",
  sections: [],
  defaultEntities: "all",
  supportedFormats: ["json", "html", "pdf"],
  enabled: true,
};

// ─── Monthly P&L fixtures ──────────────────────────────────────────────────────

const cdMonthlyPL = [
  { month: "2026-02", revenue: 155_000, cogs: 65_100, gross_profit: 89_900, opex: 44_200, net_income: 45_700 },
  { month: "2026-03", revenue: 165_000, cogs: 68_000, gross_profit: 97_000, opex: 47_100, net_income: 49_900 },
  { month: "2026-04", revenue: 158_000, cogs: 75_500, gross_profit: 82_500, opex: 50_400, net_income: 32_100 }, // weak month
  { month: "2026-05", revenue: 172_000, cogs: 70_000, gross_profit: 102_000, opex: 51_800, net_income: 50_200 },
  { month: "2026-06", revenue: 195_000, cogs: 78_000, gross_profit: 117_000, opex: 58_500, net_income: 58_500 },
  { month: "2026-07", revenue: 200_000, cogs: 80_000, gross_profit: 120_000, opex: 60_000, net_income: 60_000 }, // current month
];

const smMonthlyPL = [
  { month: "2026-02", revenue: 100_000, cogs: 50_000, gross_profit: 50_000, opex: 55_000, net_income: -5_000 },
  { month: "2026-03", revenue:  95_000, cogs: 47_500, gross_profit: 47_500, opex: 54_000, net_income: -6_500 },
  { month: "2026-04", revenue:  92_000, cogs: 46_000, gross_profit: 46_000, opex: 55_000, net_income: -9_000 },
  { month: "2026-05", revenue:  90_000, cogs: 45_000, gross_profit: 45_000, opex: 52_000, net_income: -7_000 },
  { month: "2026-06", revenue:  85_000, cogs: 42_500, gross_profit: 42_500, opex: 52_000, net_income: -9_500 },
  { month: "2026-07", revenue:  80_000, cogs: 40_000, gross_profit: 40_000, opex: 55_000, net_income: -15_000 }, // current month
];

const t3MonthlyPL = [
  { month: "2026-02", revenue: 120_000, cogs: 48_000, gross_profit: 72_000, opex: 36_000, net_income: 36_000 },
  { month: "2026-03", revenue: 125_000, cogs: 50_000, gross_profit: 75_000, opex: 37_500, net_income: 37_500 },
  { month: "2026-04", revenue: 130_000, cogs: 52_000, gross_profit: 78_000, opex: 39_000, net_income: 39_000 },
  { month: "2026-05", revenue: 135_000, cogs: 54_000, gross_profit: 81_000, opex: 40_500, net_income: 40_500 },
  { month: "2026-06", revenue: 140_000, cogs: 56_000, gross_profit: 84_000, opex: 42_000, net_income: 42_000 },
  { month: "2026-07", revenue: 145_000, cogs: 58_000, gross_profit: 87_000, opex: 43_500, net_income: 43_500 },
];

const tmMonthlyPL = [
  { month: "2026-02", revenue: 100_000, cogs: 30_000, gross_profit: 70_000, opex: 50_000, net_income: 20_000 },
  { month: "2026-03", revenue: 105_000, cogs: 31_500, gross_profit: 73_500, opex: 52_500, net_income: 21_000 },
  { month: "2026-04", revenue: 108_000, cogs: 32_400, gross_profit: 75_600, opex: 54_000, net_income: 21_600 },
  { month: "2026-05", revenue: 112_000, cogs: 33_600, gross_profit: 78_400, opex: 56_000, net_income: 22_400 },
  { month: "2026-06", revenue: 118_000, cogs: 35_400, gross_profit: 82_600, opex: 59_000, net_income: 23_600 },
  { month: "2026-07", revenue: 122_000, cogs: 36_600, gross_profit: 85_400, opex: 61_000, net_income: 24_400 },
];

// ─── Entity metrics ────────────────────────────────────────────────────────────

function carDealerMetrics() {
  return {
    entity: "CarDealer.ai", slug: "CarDealer_ai", basis: "Accrual", as_of: "2026-07-16",
    pipeline_run: "run-cd-001",
    revenue_ytd: 1_045_000, cogs_ytd: 416_600, gross_profit_ytd: 628_400, gross_margin_pct: 60.1,
    opex_ytd: 312_000, net_income_ytd: 316_400, net_margin_pct: 30.3,
    total_assets: 1_650_000, total_liabilities: 620_000, total_equity: 1_030_000,
    open_ar: 320_000, open_ap: 95_000,
    dso_days: 42, dso_days_standard: 38, weighted_average_days_overdue: 8, dpo_days: 28,
    cash_on_hand: 440_000, ar_overdue_pct: 18.5, ap_overdue_pct: 3.2,
  };
}

function smileMoreMetrics() {
  return {
    entity: "Smile More", slug: "Smile_More", basis: "Cash", as_of: "2026-07-16",
    pipeline_run: "run-sm-001",
    revenue_ytd: 542_000, cogs_ytd: 271_000, gross_profit_ytd: 271_000, gross_margin_pct: 50.0,
    opex_ytd: 323_000, net_income_ytd: -52_000, net_margin_pct: -9.6,
    total_assets: 307_500, total_liabilities: 107_500, total_equity: 200_000,
    open_ar: 42_000, open_ap: 18_000,
    dso_days: 22, dso_days_standard: null, weighted_average_days_overdue: null, dpo_days: 18,
    cash_on_hand: -12_500, ar_overdue_pct: 65.0, ap_overdue_pct: 0.0,
  };
}

function t3Metrics() {
  return {
    entity: "T3 Marketing", slug: "T3_Marketing", basis: "Cash", as_of: "2026-07-16",
    pipeline_run: "run-t3-001",
    revenue_ytd: 755_000, cogs_ytd: 299_000, gross_profit_ytd: 456_000, gross_margin_pct: 60.4,
    opex_ytd: 248_500, net_income_ytd: 218_500, net_margin_pct: 28.9,
    total_assets: 980_000, total_liabilities: 360_000, total_equity: 620_000,
    open_ar: 148_000, open_ap: 43_000,
    dso_days: 36, dso_days_standard: 30, weighted_average_days_overdue: 5, dpo_days: 20,
    cash_on_hand: 218_000, ar_overdue_pct: 28.0, ap_overdue_pct: 1.2,
  };
}

function topMrktrMetrics() {
  return {
    entity: "TopMrktr", slug: "TopMrktr", basis: "Accrual", as_of: "2026-07-16",
    pipeline_run: "run-tm-001",
    revenue_ytd: 663_000, cogs_ytd: 199_000, gross_profit_ytd: 464_000, gross_margin_pct: 70.0,
    opex_ytd: 330_500, net_income_ytd: 133_500, net_margin_pct: 20.1,
    total_assets: 870_000, total_liabilities: 285_000, total_equity: 585_000,
    open_ar: 79_000, open_ap: 21_000,
    dso_days: 30, dso_days_standard: 28, weighted_average_days_overdue: 3, dpo_days: 19,
    cash_on_hand: 192_000, ar_overdue_pct: 11.0, ap_overdue_pct: 0.4,
  };
}

// ─── Financials fixtures ───────────────────────────────────────────────────────

function buildCarDealerFinancials() {
  return {
    entity_slug: "CarDealer_ai",
    as_of: "2026-07-16",
    monthly_pl: cdMonthlyPL,
    ytd_summary: { revenue: 1_045_000, cogs: 416_600, gross_profit: 628_400, opex: 312_000, net_income: 316_400 },
    balance_sheet: {
      as_of: "2026-07-16",
      prior_as_of: "2026-06-30",
      assets: {
        cash: 440_000, cash_prior: 390_000,
        accounts_receivable: 320_000, accounts_receivable_prior: 295_000,
        prepaid_expenses: 62_000, prepaid_expenses_prior: 58_000,
        equipment_net: 185_000, equipment_net_prior: 192_000,
        total: 1_007_000, total_prior: 935_000,
      },
      liabilities: {
        accounts_payable: 95_000, accounts_payable_prior: 88_000,
        accrued_liabilities: 47_000, accrued_liabilities_prior: 45_000,
        deferred_revenue: 26_000, deferred_revenue_prior: 24_000,
        notes_payable: 0, notes_payable_prior: 0,
        total: 168_000, total_prior: 157_000,
      },
      equity: {
        paid_in_capital: 500_000, paid_in_capital_prior: 500_000,
        retained_earnings: 339_000, retained_earnings_prior: 278_000,
        total: 839_000, total_prior: 778_000,
      },
    },
    cash_flow: {
      as_of: "2026-07-16",
      sections: [
        {
          name: "Operating Activities",
          net_cash: 98_500,
          lines: [
            { label: "Beginning Cash Balance", amount: 390_000, is_subtotal: false },
            { label: "Net Income", amount: 60_000, is_subtotal: false },
            { label: "Depreciation and Amortization", amount: 7_000, is_subtotal: false },
            { label: "Increase in Accounts Receivable", amount: -25_000, is_subtotal: false },
            { label: "Increase in Accounts Payable", amount: 7_000, is_subtotal: false },
            { label: "Other Working Capital Changes", amount: -500, is_subtotal: false },
          ],
        },
        {
          name: "Investing Activities",
          net_cash: -48_500,
          lines: [
            { label: "Equipment Purchases", amount: -48_500, is_subtotal: false },
          ],
        },
        {
          name: "Financing Activities",
          net_cash: 0,
          lines: [],
        },
      ],
      net_cash_change: 50_000,
      cash_at_end: 440_000,
    },
    cash_history: [
      { label: "Feb", value: 305_000 },
      { label: "Mar", value: 340_000 },
      { label: "Apr", value: 305_000 },
      { label: "May", value: 355_000 },
      { label: "Jun", value: 390_000 },
      { label: "Jul", value: 440_000 },
    ],
  };
}

function buildSmileMoreFinancials() {
  return {
    entity_slug: "Smile_More",
    as_of: "2026-07-16",
    monthly_pl: smMonthlyPL,
    ytd_summary: { revenue: 542_000, cogs: 271_000, gross_profit: 271_000, opex: 323_000, net_income: -52_000 },
    balance_sheet: {
      as_of: "2026-07-16",
      prior_as_of: "2026-06-30",
      assets: {
        cash: -12_500, cash_prior: 1_000,
        accounts_receivable: 42_000, accounts_receivable_prior: 44_000,
        prepaid_expenses: 8_000, prepaid_expenses_prior: 8_000,
        equipment_net: 45_000, equipment_net_prior: 48_000,
        total: 82_500, total_prior: 101_000,
      },
      liabilities: {
        accounts_payable: 18_000, accounts_payable_prior: 18_000,
        accrued_liabilities: 12_000, accrued_liabilities_prior: 11_000,
        deferred_revenue: 0, deferred_revenue_prior: 0,
        notes_payable: 55_000, notes_payable_prior: 55_000,
        total: 85_000, total_prior: 84_000,
      },
      equity: {
        paid_in_capital: 100_000, paid_in_capital_prior: 100_000,
        retained_earnings: -102_500, retained_earnings_prior: -83_000,
        total: -2_500, total_prior: 17_000,
      },
    },
    cash_flow: {
      as_of: "2026-07-16",
      sections: [
        {
          name: "Operating Activities",
          net_cash: -13_500,
          lines: [
            { label: "Beginning Cash Balance", amount: 1_000, is_subtotal: false },
            { label: "Net Income", amount: -15_000, is_subtotal: false },
            { label: "Depreciation and Amortization", amount: 3_000, is_subtotal: false },
            { label: "Decrease in Accounts Receivable", amount: 2_000, is_subtotal: false },
            { label: "Other Working Capital", amount: -3_500, is_subtotal: false },
          ],
        },
        { name: "Investing Activities", net_cash: 0, lines: [] },
        { name: "Financing Activities", net_cash: 0, lines: [] },
      ],
      net_cash_change: -13_500,
      cash_at_end: -12_500,
    },
    cash_history: [
      { label: "Feb", value: 22_000 },
      { label: "Mar", value: 16_000 },
      { label: "Apr", value: 8_000 },
      { label: "May", value: 5_500 },
      { label: "Jun", value: 1_000 },
      { label: "Jul", value: -12_500 },
    ],
  };
}

function buildT3Financials() {
  return {
    entity_slug: "T3_Marketing",
    as_of: "2026-07-16",
    monthly_pl: t3MonthlyPL,
    ytd_summary: { revenue: 755_000, cogs: 299_000, gross_profit: 456_000, opex: 248_500, net_income: 218_500 },
    balance_sheet: {
      as_of: "2026-07-16",
      prior_as_of: "2026-06-30",
      assets: {
        cash: 218_000, cash_prior: 180_000,
        accounts_receivable: 148_000, accounts_receivable_prior: 138_000,
        prepaid_expenses: 22_000, prepaid_expenses_prior: 20_000,
        equipment_net: 95_000, equipment_net_prior: 100_000,
        total: 483_000, total_prior: 438_000,
      },
      liabilities: {
        accounts_payable: 43_000, accounts_payable_prior: 40_000,
        accrued_liabilities: 18_000, accrued_liabilities_prior: 17_000,
        deferred_revenue: 8_000, deferred_revenue_prior: 7_500,
        notes_payable: 0, notes_payable_prior: 0,
        total: 69_000, total_prior: 64_500,
      },
      equity: {
        paid_in_capital: 200_000, paid_in_capital_prior: 200_000,
        retained_earnings: 214_000, retained_earnings_prior: 173_500,
        total: 414_000, total_prior: 373_500,
      },
    },
    cash_flow: {
      as_of: "2026-07-16",
      sections: [
        {
          name: "Operating Activities",
          net_cash: 43_500,
          lines: [
            { label: "Beginning Cash Balance", amount: 180_000, is_subtotal: false },
            { label: "Net Income", amount: 43_500, is_subtotal: false },
          ],
        },
        { name: "Investing Activities", net_cash: -5_500, lines: [{ label: "Equipment", amount: -5_500, is_subtotal: false }] },
        { name: "Financing Activities", net_cash: 0, lines: [] },
      ],
      net_cash_change: 38_000,
      cash_at_end: 218_000,
    },
    cash_history: [
      { label: "Feb", value: 110_000 },
      { label: "Mar", value: 135_000 },
      { label: "Apr", value: 155_000 },
      { label: "May", value: 172_000 },
      { label: "Jun", value: 180_000 },
      { label: "Jul", value: 218_000 },
    ],
  };
}

function buildTopMrktrFinancials() {
  return {
    entity_slug: "TopMrktr",
    as_of: "2026-07-16",
    monthly_pl: tmMonthlyPL,
    ytd_summary: { revenue: 663_000, cogs: 199_000, gross_profit: 464_000, opex: 330_500, net_income: 133_500 },
    balance_sheet: {
      as_of: "2026-07-16",
      prior_as_of: "2026-06-30",
      assets: {
        cash: 192_000, cash_prior: 170_000,
        accounts_receivable: 79_000, accounts_receivable_prior: 75_000,
        prepaid_expenses: 15_000, prepaid_expenses_prior: 14_000,
        equipment_net: 88_000, equipment_net_prior: 92_000,
        total: 374_000, total_prior: 351_000,
      },
      liabilities: {
        accounts_payable: 21_000, accounts_payable_prior: 19_000,
        accrued_liabilities: 14_000, accrued_liabilities_prior: 13_000,
        deferred_revenue: 0, deferred_revenue_prior: 0,
        notes_payable: 0, notes_payable_prior: 0,
        total: 35_000, total_prior: 32_000,
      },
      equity: {
        paid_in_capital: 200_000, paid_in_capital_prior: 200_000,
        retained_earnings: 139_000, retained_earnings_prior: 119_000,
        total: 339_000, total_prior: 319_000,
      },
    },
    cash_flow: {
      as_of: "2026-07-16",
      sections: [
        {
          name: "Operating Activities",
          net_cash: 24_400,
          lines: [
            { label: "Beginning Cash Balance", amount: 170_000, is_subtotal: false },
            { label: "Net Income", amount: 24_400, is_subtotal: false },
          ],
        },
        { name: "Investing Activities", net_cash: -2_400, lines: [{ label: "Equipment", amount: -2_400, is_subtotal: false }] },
        { name: "Financing Activities", net_cash: 0, lines: [] },
      ],
      net_cash_change: 22_000,
      cash_at_end: 192_000,
    },
    cash_history: [
      { label: "Feb", value: 128_000 },
      { label: "Mar", value: 140_000 },
      { label: "Apr", value: 152_000 },
      { label: "May", value: 165_000 },
      { label: "Jun", value: 170_000 },
      { label: "Jul", value: 192_000 },
    ],
  };
}

// ─── Alert fixtures ────────────────────────────────────────────────────────────

const cdAlerts = [
  {
    entity: "CarDealer.ai",
    title: "AR Aging Above Historical Average",
    description: "18.5 percent of accounts receivable ($59,200) is overdue, above the 12 percent trailing average. The 30-to-60 day bucket has increased month over month.",
    severity: "medium",
    recommended_action: "Issue aging summary to collections team. Prioritize accounts greater than 45 days overdue for direct outreach.",
    financial_impact: "$59,200 at elevated collection risk",
  },
];

const smAlerts = [
  {
    entity: "Smile More",
    title: "Negative Cash Position",
    description: "Cash on hand is ($12,500) as of July 16, 2026. The entity has consumed the remaining cash reserve and is operating in deficit. Net cash declined $13,500 in July.",
    severity: "critical",
    recommended_action: "Accelerate AR collections ($42,000 outstanding). Review discretionary operating expenses for immediate reduction. Assess short-term credit facility options.",
    financial_impact: "($12,500) cash deficit — immediate liquidity action required",
  },
  {
    entity: "Smile More",
    title: "Six Consecutive Months of Net Loss",
    description: "Net income has been negative every month reviewed, with losses deepening from ($5,000) in February to ($15,000) in July. YTD net loss is ($52,000) on revenue of $542,000.",
    severity: "high",
    recommended_action: "Conduct full operating expense review. Identify the revenue and cost break-even point. Develop a 90-day recovery plan for owner review.",
    financial_impact: "($52,000) YTD net loss — trend is worsening",
  },
  {
    entity: "Smile More",
    title: "AR Overdue Rate — 65 Percent",
    description: "65 percent of the $42,000 AR balance ($27,300) is overdue. Collection priority must be elevated given the negative cash position.",
    severity: "high",
    recommended_action: "Contact all overdue accounts immediately. Pause new service extensions to the two largest overdue accounts until payment is received.",
    financial_impact: "$27,300 in overdue receivables against a negative cash position",
  },
];

const portfolioAlerts = [
  ...cdAlerts,
  ...smAlerts,
  {
    entity: "T3 Marketing",
    title: "AR Overdue — 28 Percent",
    description: "28 percent of T3 Marketing AR ($41,440) is overdue. While not critical, the rate has trended upward over the past three months.",
    severity: "low",
    recommended_action: "Send payment reminders to the three largest overdue accounts. Confirm payment timelines.",
    financial_impact: "$41,440 at risk",
  },
];

// ─── Validation fixtures ───────────────────────────────────────────────────────

const cdValidation = {
  summary: { all_passed: true, total_checks: 14, passed: 14, failed: 0 },
  freshness: { data_as_of: "2026-07-16", pipeline_run: "2026-07-16T09:00:00.000Z", qbo_connection: "active" },
};

const smValidation = {
  summary: { all_passed: false, total_checks: 14, passed: 11, failed: 3 },
  freshness: { data_as_of: "2026-07-16", pipeline_run: "2026-07-16T09:00:00.000Z", qbo_connection: "active" },
};

// ─── Report fixtures ───────────────────────────────────────────────────────────

const singleReport: BuiltReport = {
  id: "cardealer-single",
  template: TPL,
  request: { template: "monthly-close", entities: ["CarDealer_ai"], period: "July 2026", format: "pdf" },
  branding: {
    mode: "single",
    primaryEntity: { slug: "CarDealer_ai", name: "CarDealer.ai", logoPath: "/logos/cardealer-ai.png", primaryColor: "#00d4b8" },
    entities: [{ slug: "CarDealer_ai", name: "CarDealer.ai", logoPath: "/logos/cardealer-ai.png" }],
    financeosBranding: false,
  },
  generatedAt: new Date().toISOString(),
  period: "July 2026",
  source: "QuickBooks Online via FinanceOS",
  sections: {
    executive_summary: {},
    portfolio_kpis: { portfolio: null },
    entity_summary: { CarDealer_ai: { metrics: carDealerMetrics(), anomalies: [] } },
    financials: { CarDealer_ai: buildCarDealerFinancials() },
    ar_ap: {},
    alerts: cdAlerts,
    validation: cdValidation,
  },
  metadata: { entityCount: 1, dataFreshness: "2026-07-16", confidenceScore: 0.97 },
};

const smileMoreReport: BuiltReport = {
  id: "smile-more-single",
  template: TPL,
  request: { template: "monthly-close", entities: ["Smile_More"], period: "July 2026", format: "pdf" },
  branding: {
    mode: "single",
    primaryEntity: { slug: "Smile_More", name: "Smile More", logoPath: "/logos/smile-more.png", primaryColor: "#ec4899" },
    entities: [{ slug: "Smile_More", name: "Smile More", logoPath: "/logos/smile-more.png" }],
    financeosBranding: false,
  },
  generatedAt: new Date().toISOString(),
  period: "July 2026",
  source: "QuickBooks Online via FinanceOS",
  sections: {
    executive_summary: {},
    portfolio_kpis: { portfolio: null },
    entity_summary: { Smile_More: { metrics: smileMoreMetrics(), anomalies: [] } },
    financials: { Smile_More: buildSmileMoreFinancials() },
    ar_ap: {},
    alerts: smAlerts,
    validation: smValidation,
  },
  metadata: { entityCount: 1, dataFreshness: "2026-07-16", confidenceScore: 0.91 },
};

const multiReport: BuiltReport = {
  id: "portfolio-all",
  template: TPL,
  request: { template: "monthly-close", entities: "all", period: "July 2026", format: "pdf" },
  branding: {
    mode: "consolidated",
    entities: [
      { slug: "CarDealer_ai", name: "CarDealer.ai", logoPath: "/logos/cardealer-ai.png" },
      { slug: "T3_Marketing", name: "T3 Marketing", logoPath: "/logos/t3-marketing.png" },
      { slug: "TopMrktr",     name: "TopMrktr",     logoPath: "/logos/topmrktr.png" },
      { slug: "Smile_More",   name: "Smile More",   logoPath: "/logos/smile-more.png" },
    ],
    financeosBranding: true,
  },
  generatedAt: new Date().toISOString(),
  period: "July 2026",
  source: "QuickBooks Online via FinanceOS",
  sections: {
    executive_summary: {},
    portfolio_kpis: {
      portfolio: {
        portfolio_revenue_ytd: 3_005_000,
        portfolio_net_income_ytd: 616_400,
        portfolio_net_margin_pct: 20.5,
        portfolio_cash_on_hand: 837_500,
        portfolio_open_ar: 589_000,
        portfolio_open_ap: 177_000,
        cash_runway_months: 8.2,
        pipeline_run: "run-portfolio-001",
      },
    },
    entity_summary: {
      CarDealer_ai: { metrics: carDealerMetrics(), anomalies: [] },
      T3_Marketing: { metrics: t3Metrics(), anomalies: [] },
      TopMrktr:     { metrics: topMrktrMetrics(), anomalies: [] },
      Smile_More:   { metrics: smileMoreMetrics(), anomalies: [] },
    },
    financials: {
      CarDealer_ai: buildCarDealerFinancials(),
      T3_Marketing: buildT3Financials(),
      TopMrktr:     buildTopMrktrFinancials(),
      Smile_More:   buildSmileMoreFinancials(),
    },
    ar_ap: {},
    alerts: portfolioAlerts,
    validation: cdValidation,
  },
  metadata: { entityCount: 4, dataFreshness: "2026-07-16", confidenceScore: 0.95 },
};

// ─── PDF + PNG generation ─────────────────────────────────────────────────────

const FOOTER_HTML = `
  <div style="font-size:8px;color:#9ca3af;font-style:italic;width:100%;padding:0 18mm;
    display:flex;justify-content:space-between;align-items:center;box-sizing:border-box;
    font-family:Arial,Helvetica,sans-serif;">
    <span>Prepared from QuickBooks Online records. Internal management reporting, not an audited statement.</span>
    <span>Page <span class="pageNumber"></span></span>
  </div>`;

async function generateReport(report: BuiltReport, slug: string) {
  const html = renderMonthlyClose(report);
  const htmlPath = resolve(PDF_DIR, `${slug}.html`);
  writeFileSync(htmlPath, html, "utf8");
  console.log(`  HTML → ${htmlPath}`);

  const browser = await puppeteer.launch({
    headless: true,
    executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();
    await page.goto(`file://${htmlPath}`, { waitUntil: "networkidle0", timeout: 90_000 });

    const pdfPath = resolve(PDF_DIR, `${slug}.pdf`);
    await page.pdf({
      path: pdfPath,
      format: "A4",
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: "<div></div>",
      footerTemplate: FOOTER_HTML,
      margin: { top: "16mm", bottom: "16mm", left: "18mm", right: "18mm" },
    });
    console.log(`✓ PDF: ${pdfPath}`);

    // PNG captures — reload at screen resolution
    const pngSubdir = resolve(PNG_DIR, slug);
    mkdirSync(pngSubdir, { recursive: true });

    await page.setViewport({ width: 794, height: 1123, deviceScaleFactor: 1.5 });
    await page.goto(`file://${htmlPath}`, { waitUntil: "networkidle0", timeout: 90_000 });

    const coverEl = await page.$(".cover");
    if (coverEl) {
      const box = await coverEl.boundingBox();
      if (box) {
        await page.screenshot({ path: resolve(pngSubdir, "page-00-cover.png"), clip: { x: 0, y: box.y, width: box.width, height: Math.min(box.height, 1200) } });
        console.log(`  ✓ PNG page-00-cover.png`);
      }
    }

    const sections = await page.$$(".page-section");
    for (let i = 0; i < sections.length; i++) {
      const box = await sections[i]!.boundingBox();
      if (!box) continue;
      const name = `page-${String(i + 1).padStart(2, "0")}.png`;
      await page.screenshot({ path: resolve(pngSubdir, name), clip: { x: 0, y: box.y, width: box.width, height: Math.min(box.height, 1200) } });
      console.log(`  ✓ PNG ${name}`);
    }
  } finally {
    await browser.close();
  }
}

async function main() {
  console.log("\n── Generating PDFs & PNGs ─────────────────────────────────────────────────");
  await generateReport(singleReport,   "monthly-close-cardealer-single");
  await generateReport(smileMoreReport, "monthly-close-smile-more-single");
  await generateReport(multiReport,    "monthly-close-portfolio-all");
  console.log("\n── Done ───────────────────────────────────────────────────────────────────");
  console.log(`PDFs: ${PDF_DIR}`);
  console.log(`PNGs: ${PNG_DIR}`);
}

main().catch((err) => { console.error(err); process.exit(1); });
