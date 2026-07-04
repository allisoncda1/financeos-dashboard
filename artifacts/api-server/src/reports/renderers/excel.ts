/**
 * Report Engine — Excel renderer.
 *
 * Renders a BuiltReport into a fully-formatted .xlsx workbook via exceljs.
 * Renderers only transform presentation — every figure here is read
 * directly from the already-assembled BuiltReport, never recomputed.
 */

import ExcelJS from "exceljs";
import type { Renderer } from "../renderer";
import type { BuiltReport } from "../builder";
import type {
  PortfolioSummary,
  EntityMetrics,
  FinancialsData,
  MonthlyPL,
  ValidationSummary,
} from "../../lib/types";
import type { Alert } from "../../rules/evaluator";
import { normalizeValidationSummary } from "./validationView";

const FINANCEOS_VERSION = "FinanceOS Report Engine v1 (Sprint 19)";

function primaryColorHex(report: BuiltReport): string {
  const color =
    report.branding.mode === "single" && report.branding.primaryEntity
      ? report.branding.primaryEntity.primaryColor
      : "#1a1a2e";
  return color.replace("#", "").toUpperCase();
}

function styleHeaderRow(row: ExcelJS.Row, brandHex: string): void {
  row.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${brandHex}` } };
    cell.alignment = { vertical: "middle" };
  });
  row.commit();
}

function autoWidth(sheet: ExcelJS.Worksheet): void {
  sheet.columns.forEach((col) => {
    let max = 10;
    col.eachCell?.({ includeEmpty: false }, (cell) => {
      const len = String(cell.value ?? "").length;
      if (len > max) max = len;
    });
    col.width = Math.min(max + 2, 50);
  });
}

function stripeRows(sheet: ExcelJS.Worksheet, startRow: number): void {
  for (let i = startRow; i <= sheet.rowCount; i++) {
    if ((i - startRow) % 2 === 1) {
      sheet.getRow(i).eachCell((cell) => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8F8F8" } };
      });
    }
  }
}

function buildReadmeSheet(wb: ExcelJS.Workbook, report: BuiltReport): void {
  const sheet = wb.addWorksheet("README");
  sheet.columns = [{ width: 24 }, { width: 60 }];

  const entityNames =
    report.branding.mode === "single" && report.branding.primaryEntity
      ? report.branding.primaryEntity.name
      : report.branding.entities.map((e) => e.name).join(", ");

  const rows: [string, string][] = [
    ["Report Title", report.template.name],
    ["Entities", entityNames],
    ["Period", report.period],
    ["Generated At", new Date(report.generatedAt).toLocaleString("en-US")],
    ["Data Source", report.source],
    ["FinanceOS Version", FINANCEOS_VERSION],
  ];

  sheet.addRow(["Field", "Value"]);
  styleHeaderRow(sheet.getRow(1), primaryColorHex(report));
  rows.forEach((r) => sheet.addRow(r));
  sheet.getColumn(1).font = { bold: true };
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  autoWidth(sheet);
}

function buildExecutiveDashboardSheet(wb: ExcelJS.Workbook, report: BuiltReport): void {
  const sheet = wb.addWorksheet("Executive Dashboard");
  const brandHex = primaryColorHex(report);
  const portfolio = (report.sections["portfolio_kpis"] as { portfolio?: PortfolioSummary } | undefined)?.portfolio;
  const alerts = (report.sections["alerts"] as Alert[] | undefined) ?? [];

  sheet.addRow(["KPI", "Value"]);
  styleHeaderRow(sheet.getRow(1), brandHex);

  const kpis: [string, number | string | null][] = [
    ["Revenue YTD", portfolio?.portfolio_revenue_ytd ?? null],
    ["Net Income YTD", portfolio?.portfolio_net_income_ytd ?? null],
    ["Cash on Hand", portfolio?.portfolio_cash_on_hand ?? null],
    ["Open AR", portfolio?.portfolio_open_ar ?? null],
    ["Open AP", portfolio?.portfolio_open_ap ?? null],
    ["Net Margin %", portfolio ? (portfolio.portfolio_net_margin_pct ?? 0) / 100 : null],
    ["Cash Runway (months)", portfolio?.cash_runway_months ?? null],
  ];

  for (const [label, value] of kpis) {
    const row = sheet.addRow([label, value]);
    const valueCell = row.getCell(2);
    if (label === "Net Margin %") valueCell.numFmt = "0.0%";
    else if (label === "Cash Runway (months)") valueCell.numFmt = "0.0";
    else if (typeof value === "number") valueCell.numFmt = "$#,##0.00";
  }

  sheet.addRow([]);
  const summaryHeaderRow = sheet.addRow(["Alerts Summary"]);
  summaryHeaderRow.font = { bold: true };

  const bySeverity = new Map<string, number>();
  for (const a of alerts) bySeverity.set(a.severity, (bySeverity.get(a.severity) ?? 0) + 1);
  sheet.addRow(["Severity", "Count"]);
  sheet.getRow(sheet.rowCount).font = { bold: true };
  for (const sev of ["critical", "high", "medium", "low"]) {
    sheet.addRow([sev, bySeverity.get(sev) ?? 0]);
  }

  sheet.views = [{ state: "frozen", ySplit: 1 }];
  autoWidth(sheet);
  stripeRows(sheet, 2);
}

function buildPortfolioSummarySheet(wb: ExcelJS.Workbook, report: BuiltReport): void {
  const sheet = wb.addWorksheet("Portfolio Summary");
  const portfolio = (report.sections["portfolio_kpis"] as { portfolio?: PortfolioSummary } | undefined)?.portfolio;

  sheet.addRow(["KPI", "Value", "Trend"]);
  styleHeaderRow(sheet.getRow(1), primaryColorHex(report));

  if (portfolio) {
    const currencyFields: [string, number][] = [
      ["Revenue YTD", portfolio.portfolio_revenue_ytd],
      ["COGS YTD", portfolio.portfolio_cogs_ytd],
      ["Gross Profit YTD", portfolio.portfolio_gross_profit_ytd],
      ["OpEx YTD", portfolio.portfolio_opex_ytd],
      ["Net Income YTD", portfolio.portfolio_net_income_ytd],
      ["Open AR", portfolio.portfolio_open_ar],
      ["Open AP", portfolio.portfolio_open_ap],
      ["Cash on Hand", portfolio.portfolio_cash_on_hand],
    ];
    for (const [label, value] of currencyFields) {
      const row = sheet.addRow([label, value, "—"]);
      row.getCell(2).numFmt = "$#,##0.00";
    }
    const marginRow = sheet.addRow(["Net Margin %", portfolio.portfolio_net_margin_pct / 100, "—"]);
    marginRow.getCell(2).numFmt = "0.0%";
    sheet.addRow(["Entity Count", portfolio.entity_count, "—"]);
    sheet.addRow(["Cash Runway (months)", portfolio.cash_runway_months ?? "—", "—"]);
  }

  sheet.views = [{ state: "frozen", ySplit: 1 }];
  autoWidth(sheet);
  stripeRows(sheet, 2);
}

function buildPnlSheet(wb: ExcelJS.Workbook, report: BuiltReport): void {
  const sheet = wb.addWorksheet("P&L");
  const financials = report.sections["financials"] as Record<string, FinancialsData> | undefined;
  if (!financials) {
    sheet.addRow(["No financial data available for this report."]);
    autoWidth(sheet);
    return;
  }

  let currentRow = 1;
  for (const [slug, data] of Object.entries(financials)) {
    const monthly: MonthlyPL[] = data?.monthly_pl ?? [];
    if (monthly.length === 0) continue;

    const titleRow = sheet.getRow(currentRow);
    titleRow.getCell(1).value = slug;
    titleRow.font = { bold: true, size: 13 };
    currentRow += 1;

    const headerRow = sheet.getRow(currentRow);
    headerRow.getCell(1).value = "Line Item";
    monthly.forEach((m, i) => (headerRow.getCell(i + 2).value = m.month));
    styleHeaderRow(headerRow, primaryColorHex(report));
    currentRow += 1;

    const lines: { label: string; key: keyof MonthlyPL; bold?: boolean }[] = [
      { label: "Revenue", key: "revenue" },
      { label: "COGS", key: "cogs" },
      { label: "Gross Profit", key: "gross_profit" },
      { label: "Operating Expenses", key: "opex" },
      { label: "Net Income", key: "net_income", bold: true },
    ];

    for (const line of lines) {
      const row = sheet.getRow(currentRow);
      row.getCell(1).value = line.label;
      monthly.forEach((m, i) => {
        const cell = row.getCell(i + 2);
        cell.value = m[line.key] as number;
        cell.numFmt = "$#,##0.00";
      });
      if (line.bold) row.font = { bold: true };
      currentRow += 1;
    }

    currentRow += 1;
  }

  sheet.views = [{ state: "frozen", ySplit: 2 }];
  autoWidth(sheet);
}

function buildBalanceSheetSheet(wb: ExcelJS.Workbook, report: BuiltReport): void {
  const sheet = wb.addWorksheet("Balance Sheet");
  const financials = report.sections["financials"] as Record<string, FinancialsData> | undefined;
  if (!financials) {
    sheet.addRow(["No balance sheet data available for this report."]);
    autoWidth(sheet);
    return;
  }

  let currentRow = 1;
  for (const [slug, data] of Object.entries(financials)) {
    const bs = data?.balance_sheet;
    if (!bs) continue;

    sheet.getRow(currentRow).getCell(1).value = slug;
    sheet.getRow(currentRow).font = { bold: true, size: 13 };
    currentRow += 1;

    const header = sheet.getRow(currentRow);
    header.getCell(1).value = "Line Item";
    header.getCell(2).value = "Amount";
    styleHeaderRow(header, primaryColorHex(report));
    currentRow += 1;

    const sections: { title: string; rows: [string, number][] }[] = [
      {
        title: "Assets",
        rows: [
          ["Cash", bs.assets.cash],
          ["Accounts Receivable", bs.assets.accounts_receivable],
          ["Prepaid Expenses", bs.assets.prepaid_expenses],
          ["Equipment (Net)", bs.assets.equipment_net],
          ["Total Assets", bs.assets.total],
        ],
      },
      {
        title: "Liabilities",
        rows: [
          ["Accounts Payable", bs.liabilities.accounts_payable],
          ["Accrued Liabilities", bs.liabilities.accrued_liabilities],
          ["Deferred Revenue", bs.liabilities.deferred_revenue],
          ["Notes Payable", bs.liabilities.notes_payable],
          ["Total Liabilities", bs.liabilities.total],
        ],
      },
      {
        title: "Equity",
        rows: [
          ["Paid-In Capital", bs.equity.paid_in_capital],
          ["Retained Earnings", bs.equity.retained_earnings],
          ["Total Equity", bs.equity.total],
        ],
      },
    ];

    for (const section of sections) {
      const sectionRow = sheet.getRow(currentRow);
      sectionRow.getCell(1).value = section.title;
      sectionRow.font = { bold: true, italic: true };
      currentRow += 1;

      for (const [label, value] of section.rows) {
        const row = sheet.getRow(currentRow);
        row.getCell(1).value = label;
        const cell = row.getCell(2);
        cell.value = value;
        cell.numFmt = "$#,##0.00";
        if (label.startsWith("Total")) row.font = { bold: true };
        currentRow += 1;
      }
    }

    currentRow += 1;
  }

  sheet.views = [{ state: "frozen", ySplit: 2 }];
  autoWidth(sheet);
}

function severityFill(severity: string): string {
  if (severity === "critical" || severity === "high") return "FFFEE2E2";
  if (severity === "medium") return "FFFEF3C7";
  return "FFDCFCE7";
}

function buildAlertsSheet(wb: ExcelJS.Workbook, report: BuiltReport): void {
  const sheet = wb.addWorksheet("Alerts");
  const alerts = (report.sections["alerts"] as Alert[] | undefined) ?? [];

  sheet.addRow(["Severity", "Entity", "Title", "Description", "Recommended Action", "Created At"]);
  styleHeaderRow(sheet.getRow(1), primaryColorHex(report));

  if (alerts.length === 0) {
    sheet.addRow(["No active alerts.", "", "", "", "", ""]);
  } else {
    for (const alert of alerts) {
      const row = sheet.addRow([
        alert.severity,
        alert.entity,
        alert.title,
        alert.description,
        alert.recommendedAction,
        alert.createdAt,
      ]);
      row.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: severityFill(alert.severity) } };
    }
  }

  sheet.views = [{ state: "frozen", ySplit: 1 }];
  autoWidth(sheet);
}

function buildValidationSheet(wb: ExcelJS.Workbook, report: BuiltReport): void {
  const sheet = wb.addWorksheet("Validation");
  const data = report.sections["validation"] as { summary?: ValidationSummary } | undefined;
  const summary = normalizeValidationSummary(data?.summary);

  sheet.addRow(["Field", "Value"]);
  styleHeaderRow(sheet.getRow(1), primaryColorHex(report));

  if (summary) {
    sheet.addRow(["Run Date", summary.runDate ?? "—"]);
    sheet.addRow(["Total Checks", summary.totalChecks ?? "—"]);
    sheet.addRow(["Passed", summary.passed ?? "—"]);
    sheet.addRow(["Failed", summary.failed ?? "—"]);
    sheet.addRow(["Status", summary.statusLabel]);
    if (summary.note) sheet.addRow(["Note", summary.note]);
    if (summary.rulesChecked && summary.rulesChecked.length > 0) {
      sheet.addRow([]);
      const ruleHeader = sheet.addRow(["Rule Results"]);
      ruleHeader.font = { bold: true };
      for (const rule of summary.rulesChecked) {
        sheet.addRow([rule]);
      }
    }
  } else {
    sheet.addRow(["No validation data available.", ""]);
  }

  sheet.views = [{ state: "frozen", ySplit: 1 }];
  autoWidth(sheet);
  stripeRows(sheet, 2);
}

export const ExcelRenderer: Renderer = {
  format: "excel",

  async render(report: BuiltReport): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    wb.creator = "FinanceOS Report Engine";
    wb.created = new Date(report.generatedAt);

    buildReadmeSheet(wb, report);
    buildExecutiveDashboardSheet(wb, report);
    buildPortfolioSummarySheet(wb, report);
    buildPnlSheet(wb, report);
    buildBalanceSheetSheet(wb, report);
    buildAlertsSheet(wb, report);
    buildValidationSheet(wb, report);

    const arrayBuffer = await wb.xlsx.writeBuffer();
    return Buffer.from(arrayBuffer);
  },
};
