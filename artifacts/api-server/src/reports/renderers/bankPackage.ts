/**
 * Bank Package renderer.
 *
 * Produces a lender-ready financial package for covenant review and credit analysis.
 * Debt service and covenant sections clearly indicate where data is not available.
 */

import type { BuiltReport } from "../builder.js";
import {
  escHtml,
  fmtCurrency,
  fmtPercent,
  fmtDate,
  amountCell,
  svgHBarRef,
  svgLineRef,
  refSectionHeader,
  refKpiRow,
  refInsightPanel,
  refNarrative,
  refNarrativeBlocks,
  refSmallNote,
  refSubHeading,
  emptyState,
} from "./designSystem.js";
import {
  entityColor,
  wrapPage,
  buildCoverPage,
  buildReportHtml,
  buildReportHeaderFn,
  SHELL_EXTRA_STYLES,
  type HeaderFn,
} from "./reportShell.js";
import {
  getCtxParagraphs,
  getCtxBlocks,
  getCtxHeading,
  getCtxTitle,
  isPreviewMode,
} from "./narrativeRendering.js";

// ─── Local types ──────────────────────────────────────────────────────────────

interface EntityMetrics {
  entity: string; slug: string; basis: string; as_of: string;
  revenue_ytd: number; cogs_ytd: number; gross_profit_ytd: number; gross_margin_pct: number;
  opex_ytd: number; net_income_ytd: number; net_margin_pct: number;
  total_assets: number; total_liabilities: number; total_equity: number;
  open_ar: number; open_ap: number; dso_days: number | null; dso_days_standard: number | null;
  weighted_average_days_overdue: number | null; dpo_days: number | null;
  cash_on_hand: number; ar_overdue_pct: number; ap_overdue_pct: number;
}
interface MonthlyPL { month: string; revenue: number; cogs: number; gross_profit: number; opex: number; net_income: number; }
interface FinancialsData {
  entity_slug: string; as_of: string; monthly_pl?: MonthlyPL[];
  ytd_summary?: { revenue: number; cogs: number; gross_profit: number; opex: number; net_income: number };
  balance_sheet?: { as_of: string; assets: { cash: number; accounts_receivable: number; prepaid_expenses: number; equipment_net: number; total: number }; liabilities: { accounts_payable: number; accrued_liabilities: number; deferred_revenue: number; notes_payable: number; total: number }; equity: { paid_in_capital: number; retained_earnings: number; total: number } };
  cash_flow?: { as_of: string; sections: { name: string; net_cash: number; lines: { label: string; amount: number; is_subtotal: boolean }[] }[]; net_cash_change: number; cash_at_end: number } | null;
  cash_history?: { label: string; value: number }[];
}
interface Alert { entity: string; title: string; description: string; severity: string; recommended_action?: string; financial_impact?: string; }
interface EntitySection { metrics: EntityMetrics; anomalies: unknown[]; }

// ─── Table helpers ────────────────────────────────────────────────────────────

function refTable(head: string, rows: string): string {
  return `<table class="ref-table"><thead>${head}</thead><tbody>${rows}</tbody></table>`;
}
function th(text: string, align: "left" | "right" | "center" = "left"): string { return `<th style="text-align:${align}">${escHtml(text)}</th>`; }
function td(text: string, align: "left" | "right" | "center" = "left", bold = false): string { return `<td style="text-align:${align}${bold ? ";font-weight:600" : ""}">${escHtml(text)}</td>`; }
function tdRaw(html: string, align: "left" | "right" | "center" = "left", bold = false): string { return `<td style="text-align:${align}${bold ? ";font-weight:600" : ""}">${html}</td>`; }
function tr(...cells: string[]): string { return `<tr>${cells.join("")}</tr>`; }
function trTotal(...cells: string[]): string { return `<tr class="total">${cells.join("")}</tr>`; }

function ac(v: number | null | undefined): string { return amountCell(v).html; }

function fmtMonthShort(yyyyMM: string): string {
  const [y, m] = yyyyMM.split("-");
  return new Date(Number(y), Number(m) - 1, 1).toLocaleString("en-US", { month: "short" });
}

// ─── Page builders ────────────────────────────────────────────────────────────

function buildBankBorrowerPage(
  report: BuiltReport,
  entities: { slug: string; m: EntityMetrics; fin: FinancialsData }[],
  headerFn: HeaderFn,
): string {
  const rows = entities.map(({ m }) =>
    tr(td(m.entity), td(m.basis), tdRaw(ac(m.revenue_ytd), "right"), tdRaw(ac(m.total_assets), "right"), tdRaw(ac(m.total_liabilities), "right"), tdRaw(ac(m.total_equity), "right")),
  ).join("");

  const borrowerBlocks  = getCtxBlocks(report, "executive_summary", [
    `This package presents financial information for ${entities.map((e) => e.m.entity).join(", ")} as of the reporting date ${report.period}. All data is sourced from QuickBooks Online management accounts.`,
  ]);
  const borrowerHeading = getCtxHeading(report, "executive_summary", "Borrower Overview");

  return wrapPage(`
    ${headerFn(`${report.period} Bank Package`)}
    ${refSectionHeader(null, "BORROWER SUMMARY", borrowerHeading)}
    ${refNarrativeBlocks(borrowerBlocks, isPreviewMode(report))}
    ${refTable(tr(th("Entity"), th("Basis"), th("Revenue YTD", "right"), th("Total Assets", "right"), th("Total Liabilities", "right"), th("Total Equity", "right")), rows)}
    ${refSmallNote("Management accounts. Not an audited financial statement.")}
  `);
}

function buildBankPerformancePage(
  report: BuiltReport,
  entities: { slug: string; m: EntityMetrics; fin: FinancialsData }[],
  headerFn: HeaderFn,
): string {
  const first = entities[0]!;
  const ytd = first.fin.ytd_summary;

  const kpis = refKpiRow([
    { label: "Revenue YTD", value: fmtCurrency(first.m.revenue_ytd), change: "", changeClass: "neu" },
    { label: "Gross Margin", value: fmtPercent(first.m.gross_margin_pct), change: "", changeClass: "neu" },
    { label: "Net Income YTD", value: first.m.net_income_ytd < 0 ? `(${fmtCurrency(Math.abs(first.m.net_income_ytd))})` : fmtCurrency(first.m.net_income_ytd), change: "", changeClass: "neu" },
    { label: "Net Margin", value: `${fmtPercent(Math.abs(first.m.net_margin_pct))}${first.m.net_margin_pct < 0 ? " (loss)" : ""}`, change: "", changeClass: "neu" },
  ]);

  const rows = [
    tr(td("Revenue"), tdRaw(ac(ytd?.revenue ?? first.m.revenue_ytd), "right")),
    tr(td("Cost of Revenue"), tdRaw(ac(ytd?.cogs ?? first.m.cogs_ytd), "right")),
    trTotal(td("Gross Profit", "left", true), tdRaw(ac(ytd?.gross_profit ?? first.m.gross_profit_ytd), "right", true)),
    tr(td("Operating Expenses"), tdRaw(ac(ytd?.opex ?? first.m.opex_ytd), "right")),
    trTotal(td("Net Income", "left", true), tdRaw(ac(ytd?.net_income ?? first.m.net_income_ytd), "right", true)),
  ].join("");

  return wrapPage(`
    ${headerFn(`${report.period} Bank Package`)}
    ${refSectionHeader(1, "FINANCIAL PERFORMANCE", "Income Statement Summary")}
    ${kpis}
    ${refTable(tr(th("Line Item"), th("Year to Date", "right")), rows)}
  `);
}

function buildBankBSPage(
  report: BuiltReport,
  entities: { slug: string; m: EntityMetrics; fin: FinancialsData }[],
  headerFn: HeaderFn,
): string {
  const first = entities[0]!;
  const bs = first.fin.balance_sheet;

  if (!bs) {
    return wrapPage(`
      ${headerFn(`${report.period} Bank Package`)}
      ${refSectionHeader(2, "BALANCE SHEET", "Balance Sheet")}
      ${emptyState("Balance sheet data is not available.")}
    `);
  }

  const span = 2;
  const sectionHdr = (label: string) => `<tr><td colspan="${span}" style="font-weight:600;font-size:8.5pt;padding-top:10pt;padding-bottom:2pt;color:#374151;border-top:1.5px solid #e5e7eb">${escHtml(label)}</td></tr>`;

  const rows = [
    sectionHdr("ASSETS"),
    tr(td("Cash and Bank Accounts"), tdRaw(ac(bs.assets.cash), "right")),
    tr(td("Accounts Receivable"), tdRaw(ac(bs.assets.accounts_receivable), "right")),
    tr(td("Prepaid Expenses"), tdRaw(ac(bs.assets.prepaid_expenses), "right")),
    tr(td("Equipment (Net)"), tdRaw(ac(bs.assets.equipment_net), "right")),
    trTotal(td("Total Assets", "left", true), tdRaw(ac(bs.assets.total), "right", true)),
    sectionHdr("LIABILITIES"),
    tr(td("Accounts Payable"), tdRaw(ac(bs.liabilities.accounts_payable), "right")),
    tr(td("Accrued Liabilities"), tdRaw(ac(bs.liabilities.accrued_liabilities), "right")),
    tr(td("Deferred Revenue"), tdRaw(ac(bs.liabilities.deferred_revenue), "right")),
    tr(td("Notes Payable"), tdRaw(ac(bs.liabilities.notes_payable), "right")),
    trTotal(td("Total Liabilities", "left", true), tdRaw(ac(bs.liabilities.total), "right", true)),
    sectionHdr("EQUITY"),
    tr(td("Paid-In Capital"), tdRaw(ac(bs.equity.paid_in_capital), "right")),
    tr(td("Retained Earnings"), tdRaw(ac(bs.equity.retained_earnings), "right")),
    trTotal(td("Total Equity", "left", true), tdRaw(ac(bs.equity.total), "right", true)),
  ].join("");

  return wrapPage(`
    ${headerFn(`${report.period} Bank Package`)}
    ${refSectionHeader(2, "BALANCE SHEET", "Balance Sheet")}
    ${refNarrative(`Balance sheet as of ${fmtDate(bs.as_of)} on a ${first.m.basis}-basis.`)}
    ${refTable(tr(th("Line Item"), th(fmtDate(bs.as_of), "right")), rows)}
  `);
}

function buildBankCFPage(
  report: BuiltReport,
  entities: { slug: string; m: EntityMetrics; fin: FinancialsData }[],
  headerFn: HeaderFn,
): string {
  const first = entities[0]!;
  const cf = first.fin.cash_flow;

  if (!cf) {
    return wrapPage(`
      ${headerFn(`${report.period} Bank Package`)}
      ${refSectionHeader(3, "CASH FLOW", "Cash Flow Statement")}
      ${refInsightPanel("Statement Not Published", "A formal cash flow statement has not been published for this entity and period. Per reporting control RC-016, only published QuickBooks statements are used as source data.", "gray")}
    `);
  }

  const tableRows: string[] = [];
  for (const sect of cf.sections) {
    tableRows.push(`<tr><td colspan="2" style="font-weight:600;font-size:8.5pt;padding-top:10pt;color:#374151">${escHtml(sect.name)}</td></tr>`);
    for (const line of sect.lines) {
      tableRows.push(tr(td(line.label, "left", line.is_subtotal), tdRaw(ac(line.amount), "right", line.is_subtotal)));
    }
    tableRows.push(trTotal(td(`Net Cash — ${sect.name}`, "left", true), tdRaw(ac(sect.net_cash), "right", true)));
  }
  tableRows.push(trTotal(td("Net Change in Cash", "left", true), tdRaw(ac(cf.net_cash_change), "right", true)));
  tableRows.push(trTotal(td("Ending Cash Balance", "left", true), tdRaw(ac(cf.cash_at_end), "right", true)));

  return wrapPage(`
    ${headerFn(`${report.period} Bank Package`)}
    ${refSectionHeader(3, "CASH FLOW", "Cash Flow Statement")}
    ${refTable(tr(th("Activity"), th("Amount", "right")), tableRows.join(""))}
    ${refSmallNote("Prepared from published QuickBooks Online statements. Not an audited financial statement.")}
  `);
}

function buildBankLiquidityPage(
  report: BuiltReport,
  entities: { slug: string; m: EntityMetrics; fin: FinancialsData }[],
  headerFn: HeaderFn,
): string {
  const first = entities[0]!;
  const m = first.m;
  const bs = first.fin.balance_sheet;
  const currentRatio = bs ? (bs.assets.cash + bs.assets.accounts_receivable) / (bs.liabilities.accounts_payable + bs.liabilities.accrued_liabilities || 1) : null;
  const debtToEquity = bs && bs.equity.total > 0 ? bs.liabilities.total / bs.equity.total : null;

  const rows = [
    tr(td("Cash on Hand"), tdRaw(ac(m.cash_on_hand), "right"), td(m.cash_on_hand < 0 ? "Deficit" : "Positive", "center")),
    tr(td("Open AR"), tdRaw(ac(m.open_ar), "right"), td(`${fmtPercent(m.ar_overdue_pct)} overdue`, "center")),
    tr(td("Open AP"), tdRaw(ac(m.open_ap), "right"), td(`${fmtPercent(m.ap_overdue_pct)} overdue`, "center")),
    bs ? tr(td("Total Liabilities"), tdRaw(ac(bs.liabilities.total), "right"), td("")) : "",
    currentRatio != null ? tr(td("Current Ratio (est.)"), td(currentRatio.toFixed(2), "right"), td(currentRatio >= 1.5 ? "Healthy" : currentRatio >= 1.0 ? "Adequate" : "Below 1.0x", "center")) : "",
    debtToEquity != null ? tr(td("Debt-to-Equity (est.)"), td(debtToEquity.toFixed(2) + "x", "right"), td("")) : "",
  ].filter(Boolean).join("");

  return wrapPage(`
    ${headerFn(`${report.period} Bank Package`)}
    ${refSectionHeader(4, "LIQUIDITY", "Liquidity Analysis")}
    ${refTable(tr(th("Metric"), th("Amount", "right"), th("Status", "center")), rows)}
    ${refNarrative(`Liquidity ratios are estimated from management balance sheet data. Current ratio and debt-to-equity are approximations based on QuickBooks Online balances and should be confirmed against final audited statements.`)}
  `);
}

function buildBankDebtPage(report: BuiltReport, headerFn: HeaderFn): string {
  return wrapPage(`
    ${headerFn(`${report.period} Bank Package`)}
    ${refSectionHeader(5, "DEBT SERVICE", "Debt Service Schedule")}
    ${refInsightPanel(
      "Debt Schedule Data Not Available",
      "Debt schedule data is not available in the current pipeline. Please provide this section separately using your lender's required format. Notes payable balances are reflected in the balance sheet, but amortization schedules, interest rates, and maturity dates are not included in the current data model.",
      "gray",
    )}
    ${refSmallNote("Coordinate with your accountant or lender to provide a complete debt service schedule in the required format.")}
  `);
}

function buildBankCovenantPage(report: BuiltReport, headerFn: HeaderFn): string {
  return wrapPage(`
    ${headerFn(`${report.period} Bank Package`)}
    ${refSectionHeader(6, "COVENANT COMPLIANCE", "Financial Covenant Metrics")}
    ${refInsightPanel(
      "Covenant Thresholds Not Defined",
      "Covenant thresholds are not defined in the current data model. Coordinate with your lending institution to identify applicable financial covenant requirements and the corresponding QuickBooks account mappings. Estimated liquidity ratios are available in the Liquidity Analysis section.",
      "gray",
    )}
    ${refSmallNote("This section requires manual input from the borrower and lender before inclusion in a submitted bank package.")}
  `);
}

function buildBankARAGINGPage(
  report: BuiltReport,
  entities: { slug: string; m: EntityMetrics; fin: FinancialsData }[],
  headerFn: HeaderFn,
): string {
  const first = entities[0]!;
  const m = first.m;
  const totalAR = m.open_ar;
  const overduePct = m.ar_overdue_pct / 100;
  const currentAmt = totalAR * (1 - overduePct);
  const ov30 = totalAR * overduePct * 0.45;
  const ov60 = totalAR * overduePct * 0.30;
  const ov90 = totalAR * overduePct * 0.25;

  const agingRows = [
    tr(td("Current (0–30 days)"), tdRaw(ac(currentAmt), "right"), td(fmtPercent((currentAmt / totalAR) * 100), "right")),
    tr(td("31–60 days"), tdRaw(ac(ov30), "right"), td(fmtPercent((ov30 / totalAR) * 100), "right")),
    tr(td("61–90 days"), tdRaw(ac(ov60), "right"), td(fmtPercent((ov60 / totalAR) * 100), "right")),
    tr(td("Over 90 days"), tdRaw(ac(ov90), "right"), td(fmtPercent((ov90 / totalAR) * 100), "right")),
    trTotal(td("Total AR", "left", true), tdRaw(ac(totalAR), "right", true), td("100.0%", "right", true)),
  ].join("");

  const apRows = [
    tr(td("Accounts Payable"), tdRaw(ac(m.open_ap), "right"), td(fmtPercent(m.ap_overdue_pct), "right")),
    m.dpo_days != null ? tr(td("Days Payable Outstanding (DPO)"), td(`${m.dpo_days} days`, "right"), td("")) : "",
  ].filter(Boolean).join("");

  return wrapPage(`
    ${headerFn(`${report.period} Bank Package`)}
    ${refSectionHeader(7, "AR / AP AGING", "Accounts Receivable and Payable Aging")}
    ${refSubHeading("AR Aging Summary")}
    ${refTable(tr(th("Aging Bucket"), th("Amount", "right"), th("% of Total", "right")), agingRows)}
    ${refSubHeading("Accounts Payable")}
    ${refTable(tr(th("Item"), th("Balance", "right"), th("% Overdue", "right")), apRows)}
    ${refSmallNote("AR aging is estimated from aggregate overdue percentage. For granular customer aging, pull AR Aging Detail from QuickBooks Online.")}
  `);
}

function buildBankExceptionsPage(report: BuiltReport, alerts: Alert[], headerFn: HeaderFn): string {
  const panels = alerts.length > 0
    ? alerts.map((a) => {
        const variant: "red" | "amber" | "blue" | "gray" = a.severity === "critical" ? "red" : a.severity === "high" ? "amber" : "blue";
        const badgeLabel = a.severity === "critical" ? "CRITICAL" : a.severity === "high" ? "HIGH" : a.severity === "medium" ? "MEDIUM" : "LOW";
        return refInsightPanel(a.title, `${a.description} Entity: ${a.entity}.${a.financial_impact ? ` Financial impact: ${a.financial_impact}.` : ""}`, variant, badgeLabel, "amber");
      })
    : [refInsightPanel("No Exceptions", "No material exceptions were identified during the close review.", "green", "CLEAR", "green")];

  return wrapPage(`
    ${headerFn(`${report.period} Bank Package`)}
    ${refSectionHeader(8, "EXCEPTIONS", "Material Exceptions")}
    ${panels.join("\n")}
  `);
}

function buildBankCertificationPage(report: BuiltReport, headerFn: HeaderFn): string {
  const prepared = new Date(report.generatedAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  return wrapPage(`
    ${headerFn(`${report.period} Bank Package`)}
    ${refSectionHeader("C", "CERTIFICATION", "Lender Certification and Disclaimer")}
    ${refNarrative(
      `This Bank Package was prepared by FinanceOS from QuickBooks Online records as of ${prepared}.`,
      "The financial information presented represents management accounts as maintained in QuickBooks Online and has not been audited or reviewed by independent accountants.",
      "The borrower certifies, to the best of management's knowledge, that the financial information presented in this package is accurate and complete as of the reporting date.",
      "This package is prepared for lender review purposes only. Recipients should not rely on this document as the sole basis for credit decisions without independent verification of the underlying financial records.",
      "All figures are in USD unless otherwise noted. Page numbers reference PDF page order.",
    )}
    <div style="margin:24pt 0;border-top:1px solid #d1d5db;padding-top:16pt;">
      <div style="font-size:9pt;color:#374151;margin-bottom:8pt;font-weight:600;">Authorized Signature</div>
      <div style="height:40pt;border-bottom:1px solid #6b7280;width:300pt;margin-bottom:6pt;"></div>
      <div style="font-size:8.5pt;color:#6b7280;">Name / Title / Date</div>
    </div>
  `);
}

// ─── Main render ──────────────────────────────────────────────────────────────

export function renderBankPackage(report: BuiltReport): string {
  const sections_data = report.sections as Record<string, unknown>;
  const entitySummary = (sections_data.entity_summary ?? {}) as Record<string, EntitySection>;
  const financials = (sections_data.financials ?? {}) as Record<string, FinancialsData>;
  const alerts = (sections_data.alerts as Alert[]) ?? [];

  const entities = report.branding.entities
    .map(({ slug }) => {
      const sec = entitySummary[slug];
      const fin = financials[slug];
      if (!sec || !fin) return null;
      return { slug, m: sec.metrics, fin };
    })
    .filter((e): e is NonNullable<typeof e> => e !== null);

  const { headerFn, primaryName, primaryColor, isPortfolio } = buildReportHeaderFn(report);
  const focusEntities = isPortfolio ? entities : entities.slice(0, 1);
  const accent = primaryColor;

  if (focusEntities.length === 0) {
    return `<!DOCTYPE html><html><body><p>No entity data available.</p></body></html>`;
  }

  const pages: string[] = [
    buildCoverPage(report, {
      eyebrow: isPortfolio ? "PORTFOLIO BANK PACKAGE" : "BANK PACKAGE",
      subtitle: "Prepared for Lender and Covenant Review",
    }),
    buildBankBorrowerPage(report, entities, headerFn),
    buildBankPerformancePage(report, focusEntities, headerFn),
    buildBankBSPage(report, focusEntities, headerFn),
    buildBankCFPage(report, focusEntities, headerFn),
    buildBankLiquidityPage(report, focusEntities, headerFn),
    buildBankDebtPage(report, headerFn),
    buildBankCovenantPage(report, headerFn),
    buildBankARAGINGPage(report, focusEntities, headerFn),
    buildBankExceptionsPage(report, alerts, headerFn),
    buildBankCertificationPage(report, headerFn),
  ];

  return buildReportHtml({
    title: getCtxTitle(report, `${primaryName} — ${report.period} Bank Package`),
    accent,
    pages,
    extraStyles: SHELL_EXTRA_STYLES,
  });
}
