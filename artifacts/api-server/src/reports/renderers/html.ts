/**
 * Report Engine — HTML renderer.
 *
 * Renders a BuiltReport into a complete, self-contained HTML document
 * (no external URLs — logos are base64-embedded). Every other renderer
 * that produces visual output (PDF) builds on top of this one. Renderers
 * only transform presentation — they never recalculate data.
 */

import { readFileSync } from "fs";
import { join, resolve, sep } from "path";
import type { Renderer } from "../renderer";
import type { BuiltReport } from "../builder";
import type {
  PortfolioSummary,
  EntityMetrics,
  Anomaly,
  FinancialsData,
  MonthlyPL,
  ValidationSummary,
  DataFreshness,
  EntitySlug,
} from "../../lib/types";
import type { BriefingResponse } from "../../lib/types";
import type { Alert } from "../../rules/evaluator";
import { normalizeValidationSummary } from "./validationView";
import { renderMonthlyClose } from "./monthlyClose.js";
import { renderQuarterlyClose } from "./quarterlyClose.js";
import { renderBoardPackage } from "./boardPackage.js";
import { renderInvestorUpdate } from "./investorUpdate.js";
import { renderBankPackage } from "./bankPackage.js";
import { renderExecutivePackage } from "./executivePackage.js";

// ─── shared formatting helpers (also used by pdf.ts) ───────────────────────

export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function fmtCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function fmtPercent(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return `${value.toFixed(1)}%`;
}

const LOGO_CACHE = new Map<string, string | null>();

/** Base64-embeds a logo from the FinanceOS frontend's public/logos directory. */
export function embedLogo(logoPath: string | null): string | null {
  if (!logoPath) return null;
  if (LOGO_CACHE.has(logoPath)) return LOGO_CACHE.get(logoPath) ?? null;

  try {
    const relative = logoPath.replace(/^\//, "");
    const logoRoot = resolve(__dirname, "../../../../financeos/public");
    const diskPath = resolve(join(logoRoot, relative));
    if (diskPath !== logoRoot && !diskPath.startsWith(logoRoot + sep)) {
      LOGO_CACHE.set(logoPath, null);
      return null;
    }
    const bytes = readFileSync(diskPath);
    const ext = diskPath.split(".").pop()?.toLowerCase() ?? "png";
    const mime = ext === "svg" ? "image/svg+xml" : ext === "jpg" || ext === "jpeg" ? "image/jpeg" : "image/png";
    const dataUrl = `data:${mime};base64,${bytes.toString("base64")}`;
    LOGO_CACHE.set(logoPath, dataUrl);
    return dataUrl;
  } catch {
    LOGO_CACHE.set(logoPath, null);
    return null;
  }
}

// ─── section renderers ──────────────────────────────────────────────────────

function renderHeader(report: BuiltReport): string {
  const { branding, template, period, generatedAt } = report;
  const logos =
    branding.mode === "single" && branding.primaryEntity
      ? [branding.primaryEntity]
      : branding.entities;

  const logoHtml = logos
    .map((e) => {
      const src = embedLogo(e.logoPath ?? null);
      const initials = escapeHtml(e.name.slice(0, 2).toUpperCase());
      return src
        ? `<img class="entity-logo" src="${src}" alt="${escapeHtml(e.name)} logo" />`
        : `<span class="entity-logo entity-logo--fallback">${initials}</span>`;
    })
    .join("");

  const companyName =
    branding.mode === "single" && branding.primaryEntity
      ? escapeHtml(branding.primaryEntity.name)
      : "FinanceOS Portfolio";

  return `
  <header class="report-header">
    <div class="report-header__logos">${logoHtml}</div>
    <div class="report-header__text">
      <p class="report-header__company">${companyName}</p>
      <h1 class="report-header__title">${escapeHtml(template.name)}</h1>
      <p class="report-header__meta">Period: ${escapeHtml(period)} &middot; Generated ${escapeHtml(new Date(generatedAt).toLocaleString("en-US"))}</p>
    </div>
  </header>`;
}

function renderTOC(report: BuiltReport): string {
  const items = Object.keys(report.sections)
    .map((key, i) => {
      const title = report.template.sections.find((s) => s.type === key)?.title ?? key;
      return `<li><a href="#section-${escapeHtml(key)}">${i + 1}. ${escapeHtml(title)}</a></li>`;
    })
    .join("");
  return `
  <section class="report-toc">
    <h2>Table of Contents</h2>
    <ol>${items}</ol>
  </section>`;
}

function renderExecutiveSummary(section: unknown): string {
  const data = section as { executiveSummary?: string[]; greeting?: string } | undefined;
  const paragraphs = (data?.executiveSummary ?? [])
    .map((p) => `<p>${escapeHtml(p)}</p>`)
    .join("");
  return `
  <section id="section-executive_summary" class="report-section">
    <h2>Executive Summary</h2>
    ${data?.greeting ? `<p class="report-greeting">${escapeHtml(data.greeting)}</p>` : ""}
    ${paragraphs || "<p>No summary available.</p>"}
  </section>`;
}

function kpiCard(label: string, value: string): string {
  return `<div class="kpi-card"><p class="kpi-card__label">${escapeHtml(label)}</p><p class="kpi-card__value">${escapeHtml(value)}</p></div>`;
}

function renderPortfolioKpis(section: unknown): string {
  const data = section as { portfolio?: PortfolioSummary } | undefined;
  const p = data?.portfolio;
  if (!p) return `<section id="section-portfolio_kpis" class="report-section"><h2>Portfolio KPIs</h2><p>No data available.</p></section>`;

  const cards = [
    kpiCard("Revenue YTD", fmtCurrency(p.portfolio_revenue_ytd)),
    kpiCard("Net Income", fmtCurrency(p.portfolio_net_income_ytd)),
    kpiCard("Cash on Hand", fmtCurrency(p.portfolio_cash_on_hand)),
    kpiCard("Open AR", fmtCurrency(p.portfolio_open_ar)),
    kpiCard("Open AP", fmtCurrency(p.portfolio_open_ap)),
    kpiCard("Net Margin", fmtPercent(p.portfolio_net_margin_pct)),
    kpiCard("Cash Runway", p.cash_runway_months != null ? `${p.cash_runway_months.toFixed(1)} mo` : "—"),
  ].join("");

  return `
  <section id="section-portfolio_kpis" class="report-section">
    <h2>Portfolio KPIs</h2>
    <div class="kpi-grid">${cards}</div>
  </section>`;
}

function renderEntitySummary(section: unknown, report: BuiltReport): string {
  const data = section as Record<EntitySlug, { metrics: EntityMetrics; anomalies: Anomaly[] }> | undefined;
  if (!data) return "";

  const cards = Object.values(data)
    .map((entry) => {
      const m = entry.metrics;
      if (!m) return "";
      const anomalies = entry.anomalies ?? [];
      return `
      <div class="entity-card">
        <h3>${escapeHtml(m.entity)} <span class="entity-card__basis">${escapeHtml(m.basis)}</span></h3>
        <div class="entity-card__grid">
          ${kpiCard("Revenue YTD", fmtCurrency(m.revenue_ytd))}
          ${kpiCard("Net Income", fmtCurrency(m.net_income_ytd))}
          ${kpiCard("Net Margin", fmtPercent(m.net_margin_pct))}
          ${kpiCard("Cash on Hand", fmtCurrency(m.cash_on_hand))}
          ${kpiCard("Open AR", fmtCurrency(m.open_ar))}
          ${kpiCard("Open AP", fmtCurrency(m.open_ap))}
        </div>
        ${anomalies.length > 0 ? `<p class="entity-card__anomalies">${anomalies.length} anomal${anomalies.length === 1 ? "y" : "ies"} detected</p>` : ""}
      </div>`;
    })
    .join("");

  return `
  <section id="section-entity_summary" class="report-section">
    <h2>Entity Summaries</h2>
    <div class="entity-grid">${cards}</div>
  </section>`;
}

function renderPnlTable(entitySlug: string, monthlyPl: MonthlyPL[]): string {
  if (!monthlyPl?.length) return "";
  const months = monthlyPl.map((m) => escapeHtml(m.month));
  const rows: { label: string; key: keyof MonthlyPL; isPercent?: boolean }[] = [
    { label: "Revenue", key: "revenue" },
    { label: "COGS", key: "cogs" },
    { label: "Gross Profit", key: "gross_profit" },
    { label: "Operating Expenses", key: "opex" },
    { label: "Net Income", key: "net_income" },
  ];

  const bodyRows = rows
    .map(
      (r) => `
      <tr class="${r.key === "net_income" ? "table-row--total" : ""}">
        <td>${r.label}</td>
        ${monthlyPl.map((m) => `<td>${fmtCurrency(m[r.key] as number)}</td>`).join("")}
      </tr>`,
    )
    .join("");

  return `
  <div class="table-wrap">
    <h3>${escapeHtml(entitySlug)} — Monthly P&amp;L</h3>
    <table>
      <thead><tr><th>Line Item</th>${months.map((m) => `<th>${m}</th>`).join("")}</tr></thead>
      <tbody>${bodyRows}</tbody>
    </table>
  </div>`;
}

function renderBalanceSheet(entitySlug: string, financials: FinancialsData): string {
  const bs = financials?.balance_sheet;
  if (!bs) return "";
  const rows: { label: string; value: number; bold?: boolean }[] = [
    { label: "Cash", value: bs.assets.cash },
    { label: "Accounts Receivable", value: bs.assets.accounts_receivable },
    { label: "Prepaid Expenses", value: bs.assets.prepaid_expenses },
    { label: "Equipment (Net)", value: bs.assets.equipment_net },
    { label: "Total Assets", value: bs.assets.total, bold: true },
    { label: "Accounts Payable", value: bs.liabilities.accounts_payable },
    { label: "Accrued Liabilities", value: bs.liabilities.accrued_liabilities },
    { label: "Deferred Revenue", value: bs.liabilities.deferred_revenue },
    { label: "Notes Payable", value: bs.liabilities.notes_payable },
    { label: "Total Liabilities", value: bs.liabilities.total, bold: true },
    { label: "Paid-In Capital", value: bs.equity.paid_in_capital },
    { label: "Retained Earnings", value: bs.equity.retained_earnings },
    { label: "Total Equity", value: bs.equity.total, bold: true },
  ];

  const body = rows
    .map((r) => `<tr class="${r.bold ? "table-row--total" : ""}"><td>${escapeHtml(r.label)}</td><td>${fmtCurrency(r.value)}</td></tr>`)
    .join("");

  return `
  <div class="table-wrap">
    <h3>${escapeHtml(entitySlug)} — Balance Sheet</h3>
    <table><thead><tr><th>Line Item</th><th>Amount</th></tr></thead><tbody>${body}</tbody></table>
  </div>`;
}

function renderFinancials(section: unknown): string {
  const data = section as Record<string, FinancialsData> | undefined;
  if (!data) return "";
  const blocks = Object.entries(data)
    .map(([slug, financials]) => `${renderPnlTable(slug, financials?.monthly_pl ?? [])}${renderBalanceSheet(slug, financials)}`)
    .join("");
  return `
  <section id="section-financials" class="report-section">
    <h2>Financial Statements</h2>
    ${blocks}
  </section>`;
}

function severityClass(severity: string): string {
  if (severity === "critical" || severity === "high") return "severity--red";
  if (severity === "medium") return "severity--amber";
  return "severity--green";
}

function renderAlerts(section: unknown): string {
  const alerts = (section as Alert[] | undefined) ?? [];
  if (alerts.length === 0) {
    return `<section id="section-alerts" class="report-section"><h2>Alerts</h2><p>No active alerts.</p></section>`;
  }
  const rows = alerts
    .map(
      (a) => `
      <tr>
        <td><span class="severity-badge ${severityClass(a.severity)}">${escapeHtml(a.severity)}</span></td>
        <td>${escapeHtml(a.entity)}</td>
        <td>${escapeHtml(a.title)}</td>
        <td>${escapeHtml(a.description)}</td>
      </tr>`,
    )
    .join("");
  return `
  <section id="section-alerts" class="report-section">
    <h2>Alerts</h2>
    <table>
      <thead><tr><th>Severity</th><th>Entity</th><th>Title</th><th>Description</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </section>`;
}

function renderRecommendations(section: unknown): string {
  const data = section as { priorities?: { title: string; description: string }[]; opportunities?: { title: string; description: string }[] } | undefined;
  if (!data) return "";
  const priorities = (data.priorities ?? []).map((p) => `<li><strong>${escapeHtml(p.title)}</strong> — ${escapeHtml(p.description)}</li>`).join("");
  const opportunities = (data.opportunities ?? []).map((o) => `<li><strong>${escapeHtml(o.title)}</strong> — ${escapeHtml(o.description)}</li>`).join("");
  return `
  <section id="section-recommendations" class="report-section">
    <h2>Recommendations</h2>
    ${priorities ? `<h3>Priorities</h3><ul>${priorities}</ul>` : ""}
    ${opportunities ? `<h3>Opportunities</h3><ul>${opportunities}</ul>` : ""}
  </section>`;
}

function renderValidation(section: unknown): string {
  const data = section as { summary?: ValidationSummary; freshness?: DataFreshness } | undefined;
  const s = normalizeValidationSummary(data?.summary);
  if (!s) return `<section id="section-validation" class="report-section"><h2>Validation</h2><p>No validation data available.</p></section>`;
  return `
  <section id="section-validation" class="report-section">
    <h2>Validation</h2>
    <div class="kpi-grid">
      ${kpiCard("Checks Run", s.totalChecks !== undefined ? String(s.totalChecks) : "—")}
      ${kpiCard("Passed", s.passed !== undefined ? String(s.passed) : "—")}
      ${kpiCard("Failed", s.failed !== undefined ? String(s.failed) : "—")}
      ${kpiCard("Status", s.statusLabel)}
    </div>
  </section>`;
}

function renderAppendix(section: unknown): string {
  const data = section as { dataFreshness?: DataFreshness; entity_count?: number; generated_at?: string } | undefined;
  if (!data) return "";
  return `
  <section id="section-appendix" class="report-section">
    <h2>Appendix</h2>
    <p>Data as of ${escapeHtml(data.dataFreshness?.data_as_of ?? "—")} &middot; ${escapeHtml(data.entity_count ?? "—")} entities &middot; Generated ${escapeHtml(data.generated_at ?? "—")}</p>
  </section>`;
}

const SECTION_RENDERERS: Record<string, (section: unknown, report: BuiltReport) => string> = {
  executive_summary: (s) => renderExecutiveSummary(s),
  portfolio_kpis: (s) => renderPortfolioKpis(s),
  entity_summary: (s, report) => renderEntitySummary(s, report),
  financials: (s) => renderFinancials(s),
  alerts: (s) => renderAlerts(s),
  recommendations: (s) => renderRecommendations(s),
  validation: (s) => renderValidation(s),
  appendix: (s) => renderAppendix(s),
};

function renderStyles(primaryColor: string): string {
  return `
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: Arial, Helvetica, sans-serif;
      color: #1f2430;
      margin: 0;
      padding: 0 32px 48px;
      background: #ffffff;
      line-height: 1.55;
    }
    h1, h2, h3 { font-family: Georgia, 'Times New Roman', serif; color: #14161f; }
    h1 { font-size: 26px; margin: 0 0 4px; }
    h2 { font-size: 19px; margin: 0 0 14px; padding-bottom: 8px; border-bottom: 2px solid ${primaryColor}; }
    h3 { font-size: 14px; margin: 18px 0 8px; }
    a { color: ${primaryColor}; }

    .report-header {
      display: flex;
      align-items: center;
      gap: 20px;
      padding: 28px 0 20px;
      border-bottom: 3px solid ${primaryColor};
      margin-bottom: 24px;
    }
    .report-header__logos { display: flex; gap: 8px; flex-shrink: 0; }
    .entity-logo { width: 44px; height: 44px; border-radius: 10px; object-fit: contain; background: #f4f5f7; padding: 4px; }
    .entity-logo--fallback {
      width: 44px; height: 44px; border-radius: 10px; background: ${primaryColor};
      color: #fff; display: flex; align-items: center; justify-content: center;
      font-weight: bold; font-size: 14px;
    }
    .report-header__company { font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; color: #6b7280; margin: 0 0 2px; }
    .report-header__meta { font-size: 12px; color: #6b7280; margin: 4px 0 0; }

    .report-toc { margin-bottom: 28px; page-break-after: always; }
    .report-toc ol { padding-left: 20px; }
    .report-toc li { font-size: 13px; padding: 3px 0; }

    .report-section { margin-bottom: 32px; page-break-inside: avoid; }
    .report-greeting { font-style: italic; color: #4b5563; }

    .kpi-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
    .kpi-card { background: #f8f8fa; border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px 14px; }
    .kpi-card__label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em; color: #6b7280; margin: 0 0 4px; }
    .kpi-card__value { font-size: 17px; font-weight: bold; margin: 0; color: #14161f; }

    .entity-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px; }
    .entity-card { border: 1px solid #e5e7eb; border-radius: 10px; padding: 14px 16px; background: #fff; }
    .entity-card__basis { font-size: 10px; font-weight: normal; color: #9ca3af; }
    .entity-card__grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-top: 8px; }
    .entity-card__anomalies { font-size: 11px; color: #b45309; margin-top: 8px; }

    table { width: 100%; border-collapse: collapse; margin-bottom: 12px; font-size: 12px; }
    thead th {
      background: #14161f; color: #fff; text-align: left; padding: 8px 10px;
      font-weight: bold; font-size: 11px; text-transform: uppercase; letter-spacing: 0.03em;
    }
    tbody td { padding: 7px 10px; border-bottom: 1px solid #eef0f3; }
    tbody tr:nth-child(even) { background: #f8f8fa; }
    .table-row--total td { font-weight: bold; border-top: 2px solid #d1d5db; }
    .table-wrap { margin-bottom: 20px; }

    .severity-badge { padding: 2px 8px; border-radius: 999px; font-size: 10px; font-weight: bold; text-transform: uppercase; }
    .severity--red { background: #fee2e2; color: #b91c1c; }
    .severity--amber { background: #fef3c7; color: #92400e; }
    .severity--green { background: #dcfce7; color: #166534; }

    .report-footer { text-align: center; font-size: 10px; color: #9ca3af; padding-top: 20px; border-top: 1px solid #e5e7eb; }

    @media print {
      body { padding: 0 8mm; }
      .report-section { page-break-after: auto; }
      .report-toc { page-break-after: always; }
      a { color: inherit; text-decoration: none; }
    }
  </style>`;
}

export const HtmlRenderer: Renderer = {
  format: "html",

  render(report: BuiltReport): string {
    switch (report.template.id) {
      case "monthly-close": return renderMonthlyClose(report);
      case "quarterly-close": return renderQuarterlyClose(report);
      case "board-package": return renderBoardPackage(report);
      case "investor-update": return renderInvestorUpdate(report);
      case "bank-package": return renderBankPackage(report);
      case "executive-package": return renderExecutivePackage(report);
      default: break;
    }

    const primaryColor =
      report.branding.mode === "single" && report.branding.primaryEntity
        ? report.branding.primaryEntity.primaryColor
        : "#1a1a2e";

    const sectionsHtml = Object.entries(report.sections)
      .map(([type, content]) => SECTION_RENDERERS[type]?.(content, report) ?? "")
      .join("");

    const generatedTimestamp = escapeHtml(new Date(report.generatedAt).toLocaleString("en-US"));

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(report.template.name)} — ${escapeHtml(report.period)}</title>
  ${renderStyles(primaryColor)}
</head>
<body>
  ${renderHeader(report)}
  ${renderTOC(report)}
  ${sectionsHtml}
  <footer class="report-footer">
    Generated automatically by FinanceOS &middot; ${generatedTimestamp} &middot; Confidential
  </footer>
</body>
</html>`;
  },
};
