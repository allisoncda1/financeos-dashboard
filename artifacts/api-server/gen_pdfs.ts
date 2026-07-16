/**
 * PDF generation script — produces 3 PDFs and PNG page captures.
 * Usage: cd artifacts/api-server && npx tsx gen_pdfs.ts
 *
 * Outputs (relative to api-server/):
 *   out/pdf/monthly-close-cardealer-single.pdf
 *   out/pdf/monthly-close-portfolio-all.pdf
 *   out/pdf/monthly-close-smile-more-single.pdf
 *   out/png/cardealer-single/page-XX.png
 *   out/png/portfolio-all/page-XX.png
 *   out/png/smile-more-single/page-XX.png
 */

import puppeteer from "puppeteer";
import { mkdirSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
import { renderMonthlyClose } from "./src/reports/renderers/monthlyClose";
import type { BuiltReport } from "./src/reports/builder";
import type { ReportTemplate } from "./src/reports/templates";

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

// ─── Fixture helpers ──────────────────────────────────────────────────────────

function buildMonthlyPL(baseRev: number, trend: "up" | "down" | "flat") {
  const multipliers = trend === "up" ? [0.88, 0.94, 1.0] : trend === "down" ? [1.0, 0.94, 0.88] : [1.0, 1.0, 1.0];
  return [
    { month: "2026-05", revenue: baseRev * multipliers[0]!, cogs: baseRev * multipliers[0]! * 0.4, gross_profit: baseRev * multipliers[0]! * 0.6, opex: baseRev * multipliers[0]! * 0.3, net_income: baseRev * multipliers[0]! * 0.3 },
    { month: "2026-06", revenue: baseRev * multipliers[1]!, cogs: baseRev * multipliers[1]! * 0.4, gross_profit: baseRev * multipliers[1]! * 0.6, opex: baseRev * multipliers[1]! * 0.3, net_income: baseRev * multipliers[1]! * 0.3 },
    { month: "2026-07", revenue: baseRev * multipliers[2]!, cogs: baseRev * multipliers[2]! * 0.4, gross_profit: baseRev * multipliers[2]! * 0.6, opex: baseRev * multipliers[2]! * 0.3, net_income: baseRev * multipliers[2]! * 0.3 },
  ];
}

function carDealerMetrics() {
  return {
    entity: "CarDealer.ai", slug: "CarDealer_ai", basis: "Accrual", as_of: "2026-07-16", pipeline_run: "run-001",
    revenue_ytd: 1_380_000, cogs_ytd: 552_000, gross_profit_ytd: 828_000, gross_margin_pct: 60.0,
    opex_ytd: 414_000, net_income_ytd: 414_000, net_margin_pct: 30.0,
    total_assets: 2_200_000, total_liabilities: 800_000, total_equity: 1_400_000,
    open_ar: 320_000, open_ap: 95_000, dso_days: 42, dso_days_standard: 38,
    weighted_average_days_overdue: 8, dpo_days: 28, cash_on_hand: 440_000,
    ar_overdue_pct: 18.5, ap_overdue_pct: 3.2,
  };
}

function smileMoreMetrics() {
  return {
    entity: "Smile More", slug: "Smile_More", basis: "Cash", as_of: "2026-07-16", pipeline_run: "run-001",
    revenue_ytd: 560_000, cogs_ytd: 280_000, gross_profit_ytd: 280_000, gross_margin_pct: 50.0,
    opex_ytd: 310_000, net_income_ytd: -30_000, net_margin_pct: -5.36,
    total_assets: 320_000, total_liabilities: 110_000, total_equity: 210_000,
    open_ar: 42_000, open_ap: 18_000, dso_days: 22, dso_days_standard: null,
    weighted_average_days_overdue: null, dpo_days: 18, cash_on_hand: -12_500,
    ar_overdue_pct: 65.0, ap_overdue_pct: 0.0,
  };
}

function t3Metrics() {
  return {
    entity: "T3 Marketing", slug: "T3_Marketing", basis: "Cash", as_of: "2026-07-16", pipeline_run: "run-001",
    revenue_ytd: 890_000, cogs_ytd: 356_000, gross_profit_ytd: 534_000, gross_margin_pct: 60.0,
    opex_ytd: 267_000, net_income_ytd: 267_000, net_margin_pct: 30.0,
    total_assets: 1_100_000, total_liabilities: 420_000, total_equity: 680_000,
    open_ar: 150_000, open_ap: 45_000, dso_days: 38, dso_days_standard: 32,
    weighted_average_days_overdue: 5, dpo_days: 22, cash_on_hand: 210_000,
    ar_overdue_pct: 30.0, ap_overdue_pct: 1.5,
  };
}

function topMrktrMetrics() {
  return {
    entity: "TopMrktr", slug: "TopMrktr", basis: "Accrual", as_of: "2026-07-16", pipeline_run: "run-001",
    revenue_ytd: 720_000, cogs_ytd: 216_000, gross_profit_ytd: 504_000, gross_margin_pct: 70.0,
    opex_ytd: 360_000, net_income_ytd: 144_000, net_margin_pct: 20.0,
    total_assets: 900_000, total_liabilities: 300_000, total_equity: 600_000,
    open_ar: 80_000, open_ap: 22_000, dso_days: 30, dso_days_standard: 28,
    weighted_average_days_overdue: 3, dpo_days: 20, cash_on_hand: 185_000,
    ar_overdue_pct: 12.0, ap_overdue_pct: 0.5,
  };
}

function buildFinancials(slug: string, baseMonthlyRev: number, trend: "up" | "down" | "flat") {
  const pl = buildMonthlyPL(baseMonthlyRev, trend);
  const ytdRev = pl.reduce((s, m) => s + m.revenue, 0) * 3.5;
  return {
    entity_slug: slug, as_of: "2026-07-16",
    monthly_pl: pl,
    ytd_summary: { revenue: ytdRev, cogs: ytdRev * 0.4, gross_profit: ytdRev * 0.6, opex: ytdRev * 0.3, net_income: ytdRev * 0.3 },
    balance_sheet: {
      as_of: "2026-07-16",
      assets: { cash: 440_000, accounts_receivable: 320_000, prepaid_expenses: 60_000, equipment_net: 180_000, total: 1_000_000 },
      liabilities: { accounts_payable: 95_000, accrued_liabilities: 45_000, deferred_revenue: 25_000, notes_payable: 85_000, total: 250_000 },
      equity: { paid_in_capital: 250_000, retained_earnings: 500_000, total: 750_000 },
    },
    cash_flow: {
      as_of: "2026-07-16",
      sections: [
        { name: "Operating Activities", net_cash: 95_000, lines: [
          { label: "Beginning Cash", amount: 345_000, is_subtotal: false },
          { label: "Net Income", amount: 60_000, is_subtotal: false },
          { label: "Depreciation & Amortization", amount: 18_000, is_subtotal: false },
          { label: "Changes in Working Capital", amount: 17_000, is_subtotal: false },
        ]},
        { name: "Investing Activities", net_cash: -20_000, lines: [
          { label: "Equipment Purchases", amount: -20_000, is_subtotal: false },
        ]},
        { name: "Financing Activities", net_cash: -5_000, lines: [
          { label: "Loan Repayment", amount: -5_000, is_subtotal: false },
        ]},
      ],
      net_cash_change: 70_000,
      cash_at_end: 415_000,
    },
  };
}

function buildSmileMoreFinancials() {
  return {
    entity_slug: "Smile_More", as_of: "2026-07-16",
    monthly_pl: [
      { month: "2026-05", revenue: 90_000, cogs: 45_000, gross_profit: 45_000, opex: 52_000, net_income: -7_000 },
      { month: "2026-06", revenue: 85_000, cogs: 42_500, gross_profit: 42_500, opex: 52_000, net_income: -9_500 },
      { month: "2026-07", revenue: 80_000, cogs: 40_000, gross_profit: 40_000, opex: 55_000, net_income: -15_000 },
    ],
    ytd_summary: { revenue: 560_000, cogs: 280_000, gross_profit: 280_000, opex: 310_000, net_income: -30_000 },
    balance_sheet: {
      as_of: "2026-07-16",
      assets: { cash: -12_500, accounts_receivable: 42_000, prepaid_expenses: 8_000, equipment_net: 45_000, total: 82_500 },
      liabilities: { accounts_payable: 18_000, accrued_liabilities: 12_000, deferred_revenue: 0, notes_payable: 55_000, total: 85_000 },
      equity: { paid_in_capital: 100_000, retained_earnings: -102_500, total: -2_500 },
    },
    cash_flow: {
      as_of: "2026-07-16",
      sections: [
        { name: "Operating Activities", net_cash: -13_500, lines: [
          { label: "Beginning Cash", amount: 1_000, is_subtotal: false },
          { label: "Net Income", amount: -15_000, is_subtotal: false },
          { label: "Depreciation", amount: 3_000, is_subtotal: false },
          { label: "AR Increase", amount: -1_500, is_subtotal: false },
        ]},
        { name: "Investing Activities", net_cash: 0, lines: [] },
        { name: "Financing Activities", net_cash: 0, lines: [] },
      ],
      net_cash_change: -13_500,
      cash_at_end: -12_500,
    },
  };
}

const commonAlerts = [
  { entity: "CarDealer.ai", title: "AR Aging Above Threshold", description: "18.5% of AR (≈$59K) is overdue. Historical average is 12%.", severity: "medium", recommended_action: "Send aging report to collections team; prioritize top 5 overdue accounts.", financial_impact: "$59,200 at risk" },
  { entity: "Smile More", title: "Negative Cash Position", description: "Cash on hand is -$12,500. Entity is in a cash deficit as of July 16.", severity: "critical", recommended_action: "Accelerate AR collection; review discretionary spend; consider short-term credit facility.", financial_impact: "-$12,500 cash deficit" },
  { entity: "Smile More", title: "Net Loss for Period", description: "YTD net income is -$30,000 (-5.36% margin). Operating expenses exceed revenue.", severity: "high", recommended_action: "Review OPEX line-by-line for reduction opportunities; target breakeven by Q4.", financial_impact: "-$30,000 net loss YTD" },
  { entity: "T3 Marketing", title: "AR Overdue — 30%", description: "30% of AR ($45K) is overdue.", severity: "low", recommended_action: "Send reminders; confirm payment schedules.", financial_impact: "$45,000 at risk" },
];

const commonValidation = {
  summary: { all_passed: true, total_checks: 14, passed: 14, failed: 0 },
  freshness: { data_as_of: "2026-07-16", pipeline_run: "2026-07-16T09:00:00.000Z", qbo_connection: "active" },
};

// ─── Report fixtures ──────────────────────────────────────────────────────────

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
  source: "cache",
  sections: {
    executive_summary: {},
    portfolio_kpis: { portfolio: null },
    entity_summary: { CarDealer_ai: { metrics: carDealerMetrics(), anomalies: [] } },
    financials: { CarDealer_ai: buildFinancials("CarDealer_ai", 200_000, "up") },
    ar_ap: {},
    alerts: commonAlerts.filter((a) => a.entity === "CarDealer.ai"),
    validation: commonValidation,
  },
  metadata: { entityCount: 1, dataFreshness: "2026-07-16", confidenceScore: 0.97 },
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
      { slug: "TopMrktr", name: "TopMrktr", logoPath: "/logos/topmrktr.png" },
      { slug: "Smile_More", name: "Smile More", logoPath: "/logos/smile-more.png" },
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
      CarDealer_ai: buildFinancials("CarDealer_ai", 200_000, "up"),
      T3_Marketing: buildFinancials("T3_Marketing", 130_000, "flat"),
      TopMrktr: buildFinancials("TopMrktr", 105_000, "up"),
      Smile_More: buildSmileMoreFinancials(),
    },
    ar_ap: {},
    alerts: commonAlerts,
    validation: commonValidation,
  },
  metadata: { entityCount: 4, dataFreshness: "2026-07-16", confidenceScore: 0.95 },
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
  source: "cache",
  sections: {
    executive_summary: {},
    portfolio_kpis: { portfolio: null },
    entity_summary: { Smile_More: { metrics: smileMoreMetrics(), anomalies: [] } },
    financials: { Smile_More: buildSmileMoreFinancials() },
    ar_ap: {},
    alerts: commonAlerts.filter((a) => a.entity === "Smile More"),
    validation: { ...commonValidation, summary: { all_passed: false, total_checks: 14, passed: 11, failed: 3 } },
  },
  metadata: { entityCount: 1, dataFreshness: "2026-07-16", confidenceScore: 0.91 },
};

// ─── PDF + PNG generation ─────────────────────────────────────────────────────

async function generateReport(report: BuiltReport, slug: string) {
  const html = renderMonthlyClose(report);
  const htmlPath = resolve(PDF_DIR, `${slug}.html`);
  writeFileSync(htmlPath, html, "utf8");

  const browser = await puppeteer.launch({
    headless: true,
    executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const page = await browser.newPage();

  await page.goto(`file://${htmlPath}`, { waitUntil: "networkidle0", timeout: 60_000 });

  // PDF
  const pdfPath = resolve(PDF_DIR, `${slug}.pdf`);
  await page.pdf({
    path: pdfPath,
    format: "A4",
    printBackground: true,
    margin: { top: "20mm", bottom: "20mm", left: "15mm", right: "15mm" },
  });
  console.log(`✓ PDF: ${pdfPath}`);

  // PNG pages via screenshot
  const pngSubdir = resolve(PNG_DIR, slug);
  mkdirSync(pngSubdir, { recursive: true });

  // A4 in pixels at 96 DPI
  await page.setViewport({ width: 794, height: 1123, deviceScaleFactor: 1.5 });
  await page.goto(`file://${htmlPath}`, { waitUntil: "networkidle0", timeout: 60_000 });

  const pageCount: number = await page.evaluate(() => {
    const sections = document.querySelectorAll(".section");
    return Math.max(sections.length, 1);
  });

  console.log(`  ${slug}: ${pageCount} sections → capturing screenshots`);

  // Scroll-based screenshot approach: capture full page then split isn't available,
  // so capture individual sections by scrolling to each
  const sections = await page.$$(".section");
  let i = 0;
  for (const section of sections) {
    const box = await section.boundingBox();
    if (!box) continue;
    i++;
    const pagePath = resolve(pngSubdir, `page-${String(i).padStart(2, "0")}.png`);
    await page.screenshot({ path: pagePath, clip: { x: 0, y: box.y, width: box.width, height: Math.min(box.height, 1123) } });
    console.log(`  ✓ PNG: page-${String(i).padStart(2, "0")}.png`);
  }

  // Also capture cover (index 0 is the cover, not in .section)
  const coverEl = await page.$(".cover");
  if (coverEl) {
    const box = await coverEl.boundingBox();
    if (box) {
      const coverPath = resolve(pngSubdir, "page-00-cover.png");
      await page.screenshot({ path: coverPath, clip: { x: 0, y: box.y, width: box.width, height: Math.min(box.height, 1123) } });
      console.log(`  ✓ PNG: page-00-cover.png`);
    }
  }

  await browser.close();
}

async function main() {
  console.log("\n── Generating PDFs & PNG previews ──────────────────────────────────────");
  await generateReport(singleReport, "monthly-close-cardealer-single");
  await generateReport(smileMoreReport, "monthly-close-smile-more-single");
  await generateReport(multiReport, "monthly-close-portfolio-all");
  console.log("\n── Done ─────────────────────────────────────────────────────────────────");
  console.log(`PDFs: ${PDF_DIR}`);
  console.log(`PNGs: ${PNG_DIR}`);
}

main().catch((err) => { console.error(err); process.exit(1); });
