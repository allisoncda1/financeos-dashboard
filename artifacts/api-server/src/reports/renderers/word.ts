import { Document, Packer, Paragraph, Table, TableRow, TableCell, TextRun, HeadingLevel, AlignmentType, WidthType, BorderStyle, ShadingType, PageBreak, convertInchesToTwip } from "docx";
import type { Renderer } from "../renderer";
import type { BuiltReport } from "../builder";
import type { MonthlyPL, FinancialsData } from "../../lib/types";

function fmtMonth(m: string): string {
  const [y, mo] = m.split("-");
  if (!y || !mo) return m;
  return new Date(Number(y), Number(mo) - 1, 1).toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

function fmtUsd(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return "—";
  const abs = Math.abs(n);
  const f = abs.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  return n < 0 ? "($" + f + ")" : "$" + f;
}

function fmtPct(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return "—";
  return n.toFixed(1) + "%";
}

type HLV = "Heading1" | "Heading2" | "Heading3";
function heading(text: string, level: HLV = "Heading1"): Paragraph {
  return new Paragraph({ text, heading: level, spacing: { before: 240, after: 120 } });
}

function bodyP(text: string, color?: string): Paragraph {
  return new Paragraph({ children: [new TextRun({ text, color, size: 20 })], spacing: { after: 80 } });
}

function spacer(): Paragraph {
  return new Paragraph({ text: "", spacing: { after: 120 } });
}

function noBorder() {
  const b = { style: BorderStyle.NONE, size: 0, color: "auto" };
  return { top: b, bottom: b, left: b, right: b, insideH: b, insideV: b };
}

function tHeader(texts: string[], colW: number[]): TableRow {
  return new TableRow({
    tableHeader: true,
    children: texts.map((text, i) =>
      new TableCell({
        width: { size: colW[i] ?? 2000, type: WidthType.DXA },
        shading: { type: ShadingType.SOLID, color: "1a1a2e", fill: "1a1a2e" },
        borders: noBorder(),
        children: [new Paragraph({
          children: [new TextRun({ text, bold: true, color: "FFFFFF", size: 18 })],
          alignment: i === 0 ? AlignmentType.LEFT : AlignmentType.RIGHT,
        })],
      })
    ),
  });
}

function tRow(cells: string[], colW: number[], isAlt = false): TableRow {
  const fill = isAlt ? "F5F5F5" : "FFFFFF";
  return new TableRow({
    children: cells.map((text, i) =>
      new TableCell({
        width: { size: colW[i] ?? 2000, type: WidthType.DXA },
        shading: { type: ShadingType.SOLID, color: fill, fill },
        borders: noBorder(),
        children: [new Paragraph({
          children: [new TextRun({ text, size: 18 })],
          alignment: i === 0 ? AlignmentType.LEFT : AlignmentType.RIGHT,
        })],
      })
    ),
  });
}

export const WordRenderer: Renderer = {
  format: "word",
  async render(report: BuiltReport): Promise<Buffer> {
    const els: (Paragraph | Table)[] = [];
    const entityName =
      report.branding.mode === "single" && report.branding.primaryEntity
        ? report.branding.primaryEntity.name
        : "Portfolio";

    els.push(
      new Paragraph({
        children: [new TextRun({ text: entityName, bold: true, size: 48, color: "1a1a2e" })],
        spacing: { before: convertInchesToTwip(1.5), after: 200 },
      }),
      new Paragraph({
        children: [new TextRun({ text: report.template.name, size: 32, color: "4b5563" })],
        spacing: { after: 120 },
      }),
      new Paragraph({
        children: [new TextRun({ text: "Period: " + report.period, size: 24, color: "6b7280" })],
        spacing: { after: 80 },
      }),
      new Paragraph({
        children: [new TextRun({ text: "Generated: " + new Date(report.generatedAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }), size: 22, color: "9ca3af" })],
        spacing: { after: 80 },
      }),
      new Paragraph({
        children: [new TextRun({ text: "Prepared from QuickBooks Online records. Internal management reporting, not an audited statement.", size: 18, color: "9ca3af", italics: true })],
        spacing: { before: 400 },
      }),
      new Paragraph({ children: [new PageBreak()] }),
    );

    const financials = report.sections["financials"] as Record<string, FinancialsData> | undefined;
    const firstSlug = Object.keys(financials ?? {})[0];
    const fin = firstSlug ? financials?.[firstSlug] : undefined;
    const monthly: MonthlyPL[] = fin?.monthly_pl ?? [];

    if (monthly.length > 0) {
      els.push(heading("Monthly P&L Summary"));
      const colW = [1800, 1400, 1400, 1400, 1400, 1400];
      const plRows = monthly.slice(-12).map((m, i) => {
        const gm = m.revenue ? (m.gross_profit / m.revenue) * 100 : null;
        const nm = m.revenue ? (m.net_income / m.revenue) * 100 : null;
        return tRow(
          [fmtMonth(m.month), fmtUsd(m.revenue), fmtUsd(m.gross_profit), fmtPct(gm), fmtUsd(m.net_income), fmtPct(nm)],
          colW, i % 2 === 1,
        );
      });
      els.push(
        new Table({
          width: { size: 9000, type: WidthType.DXA },
          rows: [tHeader(["Month", "Revenue", "Gross Profit", "Gross Margin", "Net Income", "Net Margin"], colW), ...plRows],
          borders: noBorder(),
        }),
        spacer(),
      );
    }

    const arAp = report.sections["ar_ap"] as Record<string, { customers: unknown }> | undefined;
    const arData = firstSlug
      ? (arAp?.[firstSlug]?.customers as { aging?: { label: string; amount: number }[]; top_customers?: { name: string; balance: number }[] } | null)
      : null;
    const aging = arData?.aging ?? [];

    if (aging.length > 0) {
      els.push(new Paragraph({ children: [new PageBreak()] }), heading("AR Aging Summary"));
      const colW = [3600, 2400];
      els.push(
        new Table({
          width: { size: 6000, type: WidthType.DXA },
          rows: [tHeader(["Bucket", "Amount"], colW), ...aging.map((r, i) => tRow([r.label, fmtUsd(r.amount)], colW, i % 2 === 1))],
          borders: noBorder(),
        }),
        spacer(),
      );
    }

    const topCustomers = arData?.top_customers ?? [];
    if (topCustomers.length > 0) {
      els.push(heading("Top Customers by AR Balance", "Heading2"));
      const colW = [4000, 2400];
      els.push(
        new Table({
          width: { size: 6400, type: WidthType.DXA },
          rows: [tHeader(["Customer", "Balance"], colW), ...topCustomers.slice(0, 10).map((c, i) => tRow([c.name, fmtUsd(c.balance)], colW, i % 2 === 1))],
          borders: noBorder(),
        }),
        spacer(),
      );
    }

    els.push(
      new Paragraph({ children: [new PageBreak()] }),
      bodyP("This report was prepared from QuickBooks Online records and is intended for internal management use only. It does not constitute an audited financial statement.", "6b7280"),
      bodyP("FinanceOS Report Engine | " + entityName + " | " + report.period, "9ca3af"),
    );

    const doc = new Document({
      sections: [{
        properties: { page: { margin: { top: convertInchesToTwip(1), bottom: convertInchesToTwip(1), left: convertInchesToTwip(1.2), right: convertInchesToTwip(1.2) } } },
        children: els,
      }],
    });
    return Packer.toBuffer(doc);
  },
};
