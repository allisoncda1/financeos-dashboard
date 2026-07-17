/**
 * Quarterly Close Report renderer.
 *
 * Produces an editorial quarterly close package using the shared reportShell
 * foundation. Mirrors the monthly-close design language but scoped to quarter.
 */

import type { BuiltReport } from "../builder.js";
import {
  escHtml,
  fmtCurrency,
  fmtPercent,
  fmtDate,
  amountCell,
  svgSimpleBars,
  svgGroupedBars,
  svgHBarRef,
  refSectionHeader,
  refKpiRow,
  refInsightPanel,
  refNarrative,
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
}
interface Alert { entity: string; title: string; description: string; severity: string; recommended_action?: string; financial_impact?: string; }
interface EntitySection { metrics: EntityMetrics; anomalies: unknown[]; }

// ─── Table helpers ────────────────────────────────────────────────────────────

function refTable(head: string, rows: string, foot = ""): string {
  return `<table class="ref-table"><thead>${head}</thead><tbody>${rows}</tbody>${foot ? `<tfoot>${foot}</tfoot>` : ""}</table>`;
}
function th(text: string, align: "left" | "right" | "center" = "left"): string { return `<th style="text-align:${align}">${escHtml(text)}</th>`; }
function td(text: string, align: "left" | "right" | "center" = "left", bold = false): string { return `<td style="text-align:${align}${bold ? ";font-weight:600" : ""}">${escHtml(text)}</td>`; }
function tdRaw(html: string, align: "left" | "right" | "center" = "left", bold = false): string { return `<td style="text-align:${align}${bold ? ";font-weight:600" : ""}">${html}</td>`; }
function tr(...cells: string[]): string { return `<tr>${cells.join("")}</tr>`; }
function trTotal(...cells: string[]): string { return `<tr class="total">${cells.join("")}</tr>`; }

function ac(v: number | null | undefined): string { return amountCell(v).html; }

function fmtMonthName(yyyyMM: string): string {
  const [y, m] = yyyyMM.split("-");
  return new Date(Number(y), Number(m) - 1, 1).toLocaleString("en-US", { month: "long" });
}
function fmtMonthShort(yyyyMM: string): string {
  const [y, m] = yyyyMM.split("-");
  return new Date(Number(y), Number(m) - 1, 1).toLocaleString("en-US", { month: "short" });
}

// ─── Page builders ────────────────────────────────────────────────────────────

function buildQExecSummary(
  report: BuiltReport,
  entities: { slug: string; m: EntityMetrics; fin: FinancialsData }[],
  headerFn: HeaderFn,
): string {
  const first = entities[0]!;
  const pl = first.fin.monthly_pl ?? [];
  const cur = pl[pl.length - 1] ?? null;

  const kpis = refKpiRow([
    { label: "Revenue YTD", value: fmtCurrency(first.m.revenue_ytd), change: "", changeClass: "neu" },
    { label: "Gross Profit YTD", value: fmtCurrency(first.m.gross_profit_ytd), sub: `${fmtPercent(first.m.gross_margin_pct)} margin`, change: "", changeClass: "neu" },
    { label: "Net Income YTD", value: first.m.net_income_ytd < 0 ? `(${fmtCurrency(Math.abs(first.m.net_income_ytd))})` : fmtCurrency(first.m.net_income_ytd), sub: `${fmtPercent(Math.abs(first.m.net_margin_pct))} ${first.m.net_income_ytd < 0 ? "loss" : "margin"}`, change: "", changeClass: "neu" },
    { label: "Cash on Hand", value: first.m.cash_on_hand < 0 ? `(${fmtCurrency(Math.abs(first.m.cash_on_hand))})` : fmtCurrency(first.m.cash_on_hand), change: "", changeClass: "neu" },
  ]);

  const chartHtml = pl.length >= 2
    ? svgGroupedBars(
        pl.map((x) => fmtMonthShort(x.month)),
        [
          { label: "Revenue", color: "#00d4b8", values: pl.map((x) => x.revenue) },
          { label: "Net Income", color: "#6366f1", values: pl.map((x) => x.net_income) },
        ],
        { width: 520, height: 180, title: "Revenue and Net Income — Quarterly Trend" },
      )
    : "";

  const p1 = `${first.m.entity} closed the quarter with ${fmtCurrency(first.m.revenue_ytd)} in year-to-date revenue and ${first.m.net_income_ytd < 0 ? `a net loss of (${fmtCurrency(Math.abs(first.m.net_income_ytd))})` : `net income of ${fmtCurrency(first.m.net_income_ytd)}`} on a ${first.m.basis}-basis. Gross margin was ${fmtPercent(first.m.gross_margin_pct)}.`;

  return wrapPage(`
    ${headerFn(`${report.period} Quarterly Close Report`)}
    ${refSectionHeader(null, "EXECUTIVE SUMMARY", "Executive Financial Summary")}
    ${refNarrative(p1)}
    ${kpis}
    <div style="margin:16pt 0 8pt;">${chartHtml}</div>
  `);
}

function buildQTrendPage(
  report: BuiltReport,
  entities: { slug: string; m: EntityMetrics; fin: FinancialsData }[],
  headerFn: HeaderFn,
): string {
  const first = entities[0]!;
  const pl = first.fin.monthly_pl ?? [];

  if (pl.length === 0) {
    return wrapPage(`
      ${headerFn(`${report.period} Quarterly Close Report`)}
      ${refSectionHeader(1, "MONTHLY TREND", "3-Month P&L Trend")}
      ${emptyState("Monthly P&L data is not available for this entity.")}
    `);
  }

  const headCells = [th("Line Item"), ...pl.map((x) => th(fmtMonthName(x.month), "right"))];
  if (pl.length >= 3) headCells.push(th("Quarter Total", "right"));

  const qTotal = (key: keyof MonthlyPL) => pl.reduce((s, x) => s + (x[key] as number), 0);

  function plRow(label: string, key: keyof MonthlyPL, isTotal = false): string {
    const cells = [td(label, "left", isTotal), ...pl.map((x) => tdRaw(ac(x[key] as number), "right", isTotal))];
    if (pl.length >= 3) cells.push(tdRaw(ac(qTotal(key)), "right", isTotal));
    return isTotal ? trTotal(...cells) : tr(...cells);
  }

  const rows = [
    plRow("Revenue", "revenue"),
    plRow("Cost of Revenue", "cogs"),
    plRow("Gross Profit", "gross_profit", true),
    plRow("Operating Expenses", "opex"),
    plRow("Net Income", "net_income", true),
  ].join("");

  return wrapPage(`
    ${headerFn(`${report.period} Quarterly Close Report`)}
    ${refSectionHeader(1, "QUARTERLY P&L TREND", "3-Month P&L Trend")}
    ${refNarrative("The following table presents monthly income statement performance across the quarter.")}
    ${refTable(tr(...headCells), rows)}
    ${refSmallNote("Figures derived from QuickBooks Online. Not an audited financial statement.")}
  `);
}

function buildQPortfolioPage(
  report: BuiltReport,
  entities: { slug: string; m: EntityMetrics; fin: FinancialsData }[],
  headerFn: HeaderFn,
): string | null {
  if (entities.length <= 1) return null;

  const revBars = svgHBarRef(
    entities.map(({ m }) => ({ label: m.entity, value: m.revenue_ytd, color: entityColor(m.slug) })),
    { width: 520 },
  );

  const rows = entities.map(({ m }) =>
    tr(td(m.entity), tdRaw(ac(m.revenue_ytd), "right"), td(fmtPercent(m.gross_margin_pct), "right"),
      tdRaw(ac(m.net_income_ytd), "right"), td(fmtPercent(m.net_margin_pct), "right"), tdRaw(ac(m.cash_on_hand), "right")),
  ).join("");

  const totalRevYTD = entities.reduce((s, { m }) => s + m.revenue_ytd, 0);
  const totalNI = entities.reduce((s, { m }) => s + m.net_income_ytd, 0);

  return wrapPage(`
    ${headerFn(`${report.period} Quarterly Close Report`)}
    ${refSectionHeader(null, "PORTFOLIO OVERVIEW", "Portfolio Financial Summary")}
    ${refNarrative(`The portfolio closed the quarter with ${fmtCurrency(totalRevYTD)} in combined year-to-date revenue across ${entities.length} entities. Aggregate net income was ${totalNI < 0 ? `(${fmtCurrency(Math.abs(totalNI))})` : fmtCurrency(totalNI)}.`)}
    ${refSubHeading("YTD Revenue by Entity")}
    <div style="margin:10pt 0;">${revBars}</div>
    ${refSubHeading("Entity Performance — Quarter Summary")}
    ${refTable(tr(th("Entity"), th("Revenue YTD", "right"), th("GM %", "right"), th("Net Income", "right"), th("NM %", "right"), th("Cash", "right")), rows)}
  `);
}

function buildQPLPage(
  report: BuiltReport,
  entities: { slug: string; m: EntityMetrics; fin: FinancialsData }[],
  headerFn: HeaderFn,
): string {
  const first = entities[0]!;
  const ytd = first.fin.ytd_summary;

  const rows = [
    tr(td("Revenue"), tdRaw(ac(ytd?.revenue ?? first.m.revenue_ytd), "right")),
    tr(td("Cost of Revenue"), tdRaw(ac(ytd?.cogs ?? first.m.cogs_ytd), "right")),
    trTotal(td("Gross Profit", "left", true), tdRaw(ac(ytd?.gross_profit ?? first.m.gross_profit_ytd), "right", true)),
    tr(td("Operating Expenses"), tdRaw(ac(ytd?.opex ?? first.m.opex_ytd), "right")),
    trTotal(td("Net Income", "left", true), tdRaw(ac(ytd?.net_income ?? first.m.net_income_ytd), "right", true)),
  ].join("");

  return wrapPage(`
    ${headerFn(`${report.period} Quarterly Close Report`)}
    ${refSectionHeader(2, "PROFIT AND LOSS", "Quarterly P&L Statement")}
    ${refNarrative(`Year-to-date profit and loss for ${first.m.entity} on a ${first.m.basis}-basis as of ${report.period}.`)}
    ${refTable(tr(th("Line Item"), th("Year to Date", "right")), rows)}
    ${refSmallNote("Derived from QuickBooks Online. Not an audited financial statement.")}
  `);
}

function buildQBSPage(
  report: BuiltReport,
  entities: { slug: string; m: EntityMetrics; fin: FinancialsData }[],
  headerFn: HeaderFn,
): string {
  const first = entities[0]!;
  const bs = first.fin.balance_sheet;

  if (!bs) {
    return wrapPage(`
      ${headerFn(`${report.period} Quarterly Close Report`)}
      ${refSectionHeader(3, "BALANCE SHEET", "Balance Sheet")}
      ${emptyState("Balance sheet data is not available.")}
    `);
  }

  const rows = [
    tr(td("Cash and Bank Accounts"), tdRaw(ac(bs.assets.cash), "right")),
    tr(td("Accounts Receivable"), tdRaw(ac(bs.assets.accounts_receivable), "right")),
    tr(td("Prepaid Expenses"), tdRaw(ac(bs.assets.prepaid_expenses), "right")),
    tr(td("Equipment (Net)"), tdRaw(ac(bs.assets.equipment_net), "right")),
    trTotal(td("Total Assets", "left", true), tdRaw(ac(bs.assets.total), "right", true)),
    tr(td("Accounts Payable"), tdRaw(ac(bs.liabilities.accounts_payable), "right")),
    tr(td("Accrued Liabilities"), tdRaw(ac(bs.liabilities.accrued_liabilities), "right")),
    tr(td("Notes Payable"), tdRaw(ac(bs.liabilities.notes_payable), "right")),
    trTotal(td("Total Liabilities", "left", true), tdRaw(ac(bs.liabilities.total), "right", true)),
    trTotal(td("Total Equity", "left", true), tdRaw(ac(bs.equity.total), "right", true)),
  ].join("");

  return wrapPage(`
    ${headerFn(`${report.period} Quarterly Close Report`)}
    ${refSectionHeader(3, "BALANCE SHEET", "Balance Sheet")}
    ${refTable(tr(th("Line Item"), th(fmtDate(bs.as_of), "right")), rows)}
  `);
}

function buildQCFPage(
  report: BuiltReport,
  entities: { slug: string; m: EntityMetrics; fin: FinancialsData }[],
  headerFn: HeaderFn,
): string {
  const first = entities[0]!;
  const cf = first.fin.cash_flow;

  if (!cf) {
    return wrapPage(`
      ${headerFn(`${report.period} Quarterly Close Report`)}
      ${refSectionHeader(4, "CASH FLOW", "Cash Flow Statement")}
      ${refInsightPanel("Statement Not Published", "A formal cash flow statement has not been published for this entity and period.", "gray")}
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
    ${headerFn(`${report.period} Quarterly Close Report`)}
    ${refSectionHeader(4, "CASH FLOW", "Cash Flow Statement")}
    ${refTable(tr(th("Activity"), th("Amount", "right")), tableRows.join(""))}
    ${refSmallNote("Prepared from published QuickBooks Online statements. Not an audited financial statement.")}
  `);
}

function buildQARAPPage(
  report: BuiltReport,
  entities: { slug: string; m: EntityMetrics; fin: FinancialsData }[],
  headerFn: HeaderFn,
): string {
  const first = entities[0]!;
  const m = first.m;
  const overdueAmt = m.open_ar * (m.ar_overdue_pct / 100);

  const rows = [
    tr(td("Open AR"), tdRaw(ac(m.open_ar), "right"), td(""), td("")),
    tr(td("  — Overdue"), tdRaw(ac(overdueAmt), "right"), td(fmtPercent(m.ar_overdue_pct), "right"), td(m.dso_days != null ? `${m.dso_days} days DSO` : "—")),
    tr(td("Open AP"), tdRaw(ac(m.open_ap), "right"), td(fmtPercent(m.ap_overdue_pct) + " overdue", "right"), td("")),
  ].join("");

  return wrapPage(`
    ${headerFn(`${report.period} Quarterly Close Report`)}
    ${refSectionHeader(5, "ACCOUNTS RECEIVABLE / PAYABLE", "AR and AP Summary")}
    ${refTable(tr(th("Item"), th("Amount", "right"), th("Overdue %", "right"), th("Days / DSO")), rows)}
  `);
}

function buildQRisksPage(
  report: BuiltReport,
  alerts: Alert[],
  headerFn: HeaderFn,
): string {
  const panels = alerts.length > 0
    ? alerts.map((a) => {
        const variant: "red" | "amber" | "blue" | "gray" = a.severity === "critical" ? "red" : a.severity === "high" ? "amber" : "blue";
        const badgeLabel = a.severity === "critical" ? "CRITICAL" : a.severity === "high" ? "HIGH" : a.severity === "medium" ? "MEDIUM" : "LOW";
        return refInsightPanel(a.title, `${a.description} Entity: ${a.entity}.`, variant, badgeLabel, "amber");
      })
    : [refInsightPanel("No Material Risks", "No material risks were identified during the quarterly close review.", "green", "CLEAR", "green")];

  return wrapPage(`
    ${headerFn(`${report.period} Quarterly Close Report`)}
    ${refSectionHeader(6, "RISKS AND EXCEPTIONS", "Quarterly Risks and Exceptions")}
    ${panels.join("\n")}
  `);
}

function buildQRecommendationsPage(report: BuiltReport, headerFn: HeaderFn): string {
  return wrapPage(`
    ${headerFn(`${report.period} Quarterly Close Report`)}
    ${refSectionHeader(7, "RECOMMENDATIONS", "Management Recommendations")}
    ${refNarrative(
      "The following recommendations are based on the quarterly close analysis. Review priorities with the owner before the next quarter begins.",
      "1. Confirm all bank accounts are reconciled in QuickBooks Online.",
      "2. Review AR aging and escalate overdue accounts to direct outreach.",
      "3. Confirm operating expense run rates are within budget for the upcoming quarter.",
      "4. Archive this quarterly close package for audit readiness.",
    )}
  `);
}

function buildQAppendixPage(report: BuiltReport, headerFn: HeaderFn): string {
  return wrapPage(`
    ${headerFn(`${report.period} Quarterly Close Report`)}
    ${refSectionHeader("A", "APPENDIX", "Appendix and Notes")}
    ${refSubHeading("Quarter-over-Quarter Comparison")}
    ${emptyState("Quarter-over-quarter comparison requires prior quarter data, which is not yet available in the pipeline. This section will populate automatically once the prior quarter close is complete.")}
    ${refSubHeading("Data Source and Basis")}
    ${refNarrative("All financial data sourced from QuickBooks Online via FinanceOS. This is an internal management report and has not been audited or reviewed by independent accountants. Figures may not sum precisely due to rounding.")}
  `);
}

// ─── Main render ──────────────────────────────────────────────────────────────

export function renderQuarterlyClose(report: BuiltReport): string {
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

  const portfolioPage = buildQPortfolioPage(report, entities, headerFn);

  const pages: string[] = [
    buildCoverPage(report, {
      eyebrow: isPortfolio ? "PORTFOLIO QUARTERLY CLOSE REPORT" : "QUARTERLY CLOSE REPORT",
      subtitle: "Quarterly Financial Review and Management Summary",
    }),
    buildQExecSummary(report, focusEntities, headerFn),
    buildQTrendPage(report, focusEntities, headerFn),
    ...(portfolioPage ? [portfolioPage] : []),
    buildQPLPage(report, focusEntities, headerFn),
    buildQBSPage(report, focusEntities, headerFn),
    buildQCFPage(report, focusEntities, headerFn),
    buildQARAPPage(report, focusEntities, headerFn),
    buildQRisksPage(report, alerts, headerFn),
    buildQRecommendationsPage(report, headerFn),
    buildQAppendixPage(report, headerFn),
  ].filter(Boolean) as string[];

  return buildReportHtml({
    title: `${primaryName} — ${report.period} Quarterly Close Report`,
    accent,
    pages,
    extraStyles: SHELL_EXTRA_STYLES,
  });
}
