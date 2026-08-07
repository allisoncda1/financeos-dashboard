import { Document, Packer, Paragraph, Table, TableRow, TableCell, TextRun, AlignmentType, WidthType, BorderStyle, ShadingType, PageBreak, convertInchesToTwip } from "docx";
import type { Renderer } from "../renderer";
import type { BuiltReport } from "../builder";
import type { MonthlyPL, FinancialsData } from "../../lib/types";

const FONT = "Calibri";
const NAVY = "1a1a2e";
const ACCENT = "7c3aed";
const GRAY = "6b7280";
const WHITE = "FFFFFF";

function periodToTargetMonth(period: string): string {
  const m: Record<string, string> = { Jan:"01",Feb:"02",Mar:"03",Apr:"04",May:"05",Jun:"06",Jul:"07",Aug:"08",Sep:"09",Oct:"10",Nov:"11",Dec:"12" };
  const match = period.match(/^([A-Za-z]+)\s+(\d{4})/);
  if (!match) return "";
  return match[2] + "-" + (m[match[1]] ?? "01");
}

function fmtMonth(m: string): string {
  const [y, mo] = m.split("-");
  if (!y || !mo) return m;
  return new Date(Number(y), Number(mo) - 1, 1).toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

function fmtUsd(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return "-";
  const abs = Math.abs(n);
  const ff = abs.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  return n < 0 ? "($" + ff + ")" : "$" + ff;
}

function fmtPct(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return "-";
  return n.toFixed(1) + "%";
}

function noBorder() {
  const b = { style: BorderStyle.NONE, size: 0, color: "auto" };
  return { top: b, bottom: b, left: b, right: b, insideH: b, insideV: b };
}

function thinBorder() {
  const b = { style: BorderStyle.SINGLE, size: 1, color: "e5e7eb" };
  return { top: b, bottom: b, left: b, right: b, insideH: b, insideV: b };
}

function sectionTitle(text: string): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text: text.toUpperCase(), font: FONT, bold: true, size: 18, color: ACCENT, characterSpacing: 40 })],
    spacing: { before: 360, after: 160 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: ACCENT } },
  });
}

function kpiRow(label: string, value: string, sub?: string): Paragraph {
  const runs: TextRun[] = [
    new TextRun({ text: label + "  ", font: FONT, size: 20, color: GRAY }),
    new TextRun({ text: value, font: FONT, size: 24, bold: true, color: NAVY }),
  ];
  if (sub) runs.push(new TextRun({ text: "  " + sub, font: FONT, size: 18, color: GRAY }));
  return new Paragraph({ children: runs, spacing: { after: 100 } });
}

function tHeader(texts: string[], colW: number[]): TableRow {
  return new TableRow({ tableHeader: true, children: texts.map((text, i) =>
    new TableCell({
      width: { size: colW[i] ?? 1500, type: WidthType.DXA },
      shading: { type: ShadingType.SOLID, color: NAVY, fill: NAVY },
      borders: noBorder(),
      margins: { top: 80, bottom: 80, left: 120, right: 120 },
      children: [new Paragraph({
        children: [new TextRun({ text, font: FONT, bold: true, color: WHITE, size: 16 })],
        alignment: i === 0 ? AlignmentType.LEFT : AlignmentType.RIGHT,
      })],
    })
  )});
}

function tRow(cells: string[], colW: number[], isAlt = false, bold = false): TableRow {
  const fill = isAlt ? "f0eeff" : WHITE;
  return new TableRow({ children: cells.map((text, i) =>
    new TableCell({
      width: { size: colW[i] ?? 1500, type: WidthType.DXA },
      shading: { type: ShadingType.SOLID, color: fill, fill },
      borders: thinBorder(),
      margins: { top: 60, bottom: 60, left: 120, right: 120 },
      children: [new Paragraph({
        children: [new TextRun({ text, font: FONT, bold, size: 17, color: NAVY })],
        alignment: i === 0 ? AlignmentType.LEFT : AlignmentType.RIGHT,
      })],
    })
  ));
}

function tTotal(cells: string[], colW: number[]): TableRow {
  return new TableRow({ children: cells.map((text, i) =>
    new TableCell({
      width: { size: colW[i] ?? 1500, type: WidthType.DXA },
      shading: { type: ShadingType.SOLID, color: "e9e4ff", fill: "e9e4ff" },
      borders: thinBorder(),
      margins: { top: 80, bottom: 80, left: 120, right: 120 },
      children: [new Paragraph({
        children: [new TextRun({ text, font: FONT, bold: true, size: 17, color: NAVY })],
        alignment: i === 0 ? AlignmentType.LEFT : AlignmentType.RIGHT,
      })],
    })
  ));
}

export const WordRenderer: Renderer = {
  format: "word",
  async render(report: BuiltReport): Promise<Buffer> {
    const els: (Paragraph | Table)[] = [];
    const targetMonth = periodToTargetMonth(report.period);
    const entityName = report.branding.mode === "single" && report.branding.primaryEntity ? report.branding.primaryEntity.name : "Portfolio";

    els.push(
      new Paragraph({ children: [new TextRun({ text: "", font: FONT, size: 24 })], spacing: { before: convertInchesToTwip(0.8) } }),
      new Paragraph({ children: [new TextRun({ text: entityName, font: FONT, bold: true, size: 64, color: NAVY })], spacing: { after: 160 } }),
      new Paragraph({ children: [new TextRun({ text: report.template.name, font: FONT, size: 36, color: ACCENT, bold: true })], spacing: { after: 120 } }),
      new Paragraph({ children: [new TextRun({ text: report.period, font: FONT, size: 28, color: GRAY })], spacing: { after: 80 } }),
      new Paragraph({ children: [new TextRun({ text: "Generated " + new Date(report.generatedAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }), font: FONT, size: 20, color: GRAY })], spacing: { after: convertInchesToTwip(0.4) } }),
      new Paragraph({ border: { top: { style: BorderStyle.SINGLE, size: 6, color: ACCENT } }, children: [new TextRun({ text: "Prepared from QuickBooks Online records. Internal management reporting, not an audited statement.", font: FONT, size: 16, color: GRAY, italics: true })], spacing: { before: 160, after: 80 } }),
      new Paragraph({ children: [new PageBreak()] }),
    );

    const financials = report.sections["financials"] as Record<string, FinancialsData> | undefined;
    const firstSlug = Object.keys(financials ?? {})[0];
    const fin = firstSlug ? financials?.[firstSlug] : undefined;
    const allMonthly: MonthlyPL[] = fin?.monthly_pl ?? [];
    const monthly = targetMonth ? allMonthly.filter(m => m.month <= targetMonth) : allMonthly;
    const last12 = monthly.slice(-12);

    if (last12.length > 0) {
      const cur = last12[last12.length - 1]!;
      const prev = last12[last12.length - 2];
      els.push(sectionTitle("Financial Highlights - " + fmtMonth(cur.month)));
      els.push(kpiRow("Revenue", fmtUsd(cur.revenue), prev ? "vs " + fmtUsd(prev.revenue) + " prior month" : undefined));
      els.push(kpiRow("Gross Profit", fmtUsd(cur.gross_profit), cur.revenue ? fmtPct(cur.gross_profit / cur.revenue * 100) + " margin" : undefined));
      els.push(kpiRow("Net Income", fmtUsd(cur.net_income), cur.revenue ? fmtPct(cur.net_income / cur.revenue * 100) + " margin" : undefined));
      els.push(new Paragraph({ text: "", spacing: { after: 200 } }));
      els.push(sectionTitle("Monthly P&L Summary"));
      const colW = [1600, 1300, 1300, 1300, 1300, 1300];
      const plRows = last12.map((m, i) => {
        const gm = m.revenue ? (m.gross_profit / m.revenue) * 100 : null;
        const nm = m.revenue ? (m.net_income / m.revenue) * 100 : null;
        return tRow([fmtMonth(m.month), fmtUsd(m.revenue), fmtUsd(m.gross_profit), fmtPct(gm), fmtUsd(m.net_income), fmtPct(nm)], colW, i % 2 === 1, m.month === cur.month);
      });
      els.push(new Table({ width: { size: 8800, type: WidthType.DXA }, rows: [tHeader(["Month", "Revenue", "Gross Profit", "Gross Margin", "Net Income", "Net Margin"], colW), ...plRows], borders: noBorder() }));
      els.push(new Paragraph({ text: "", spacing: { after: 120 } }));
    }

    const arAp = report.sections["ar_ap"] as Record<string, { customers: unknown }> | undefined;
    const arData = firstSlug ? (arAp?.[firstSlug]?.customers as { aging?: { label: string; amount: number }[]; top_customers?: { name: string; balance: number }[] } | null) : null;
    const aging = arData?.aging ?? [];

    if (aging.length > 0) {
      els.push(new Paragraph({ children: [new PageBreak()] }));
      els.push(sectionTitle("AR Aging Summary"));
      const colW = [4000, 2400];
      const total = aging.reduce((s, r) => s + r.amount, 0);
      els.push(new Table({ width: { size: 6400, type: WidthType.DXA }, rows: [tHeader(["Aging Bucket", "Amount"], colW), ...aging.map((r, i) => tRow([r.label, fmtUsd(r.amount)], colW, i % 2 === 1)), tTotal(["Total AR", fmtUsd(total)], colW)], borders: noBorder() }));
      els.push(new Paragraph({ text: "", spacing: { after: 120 } }));
    }

    const topCustomers = arData?.top_customers ?? [];
    if (topCustomers.length > 0) {
      els.push(sectionTitle("Top Customers by AR Balance"));
      const colW = [4500, 2400];
      els.push(new Table({ width: { size: 6900, type: WidthType.DXA }, rows: [tHeader(["Customer", "Balance"], colW), ...topCustomers.slice(0, 10).map((c, i) => tRow([c.name, fmtUsd(c.balance)], colW, i % 2 === 1))], borders: noBorder() }));
      els.push(new Paragraph({ text: "", spacing: { after: 120 } }));
    }

    els.push(
      new Paragraph({ children: [new PageBreak()] }),
      new Paragraph({ children: [new TextRun({ text: "This report was prepared from QuickBooks Online records and is intended for internal management use only. It does not constitute an audited financial statement.", font: FONT, size: 16, color: GRAY, italics: true })], spacing: { after: 80 } }),
      new Paragraph({ children: [new TextRun({ text: "FinanceOS Report Engine  |  " + entityName + "  |  " + report.period, font: FONT, size: 16, color: GRAY })] }),
    );

    const doc = new Document({
      styles: { default: { document: { run: { font: FONT, size: 20, color: NAVY } } } },
      sections: [{ properties: { page: { margin: { top: convertInchesToTwip(1), bottom: convertInchesToTwip(1), left: convertInchesToTwip(1.2), right: convertInchesToTwip(1.2) } } }, children: els }],
    });
    return Packer.toBuffer(doc);
  },
};
