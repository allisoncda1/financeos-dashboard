import {
  Document, Packer, Paragraph, Table, TableRow, TableCell,
  TextRun, HeadingLevel, AlignmentType, WidthType, BorderStyle,
  ShadingType, convertInchesToTwip, PageBreak,
} from "docx";
import type { Renderer } from "../renderer.js";
import type { BuiltReport } from "../builder.js";
import type { MonthlyPL } from "../../lib/types.js";

function periodToTargetMonth(period: string): string | null {
  const m = period.match(/^([A-Za-z]+)\s+(\d{4})/);
  if (!m) return null;
  const monthIdx = new Date(`${m[1]} 1, ${m[2]}`).getMonth() + 1;
  if (isNaN(monthIdx)) return null;
  return `${m[2]}-${String(monthIdx).padStart(2, "0")}`;
}

function fmt(n: number): string {
  if (n < 0) return `($${Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`;
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function pct(n: number): string { return `${n.toFixed(1)}%`; }

function h1(text: string): Paragraph {
  return new Paragraph({ text, heading: HeadingLevel.HEADING_1, spacing: { before: 240, after: 120 } });
}

function h2(text: string): Paragraph {
  return new Paragraph({ text, heading: HeadingLevel.HEADING_2, spacing: { before: 200, after: 80 } });
}

function p(text: string): Paragraph {
  return new Paragraph({ children: [new TextRun({ text, size: 20 })], spacing: { after: 100 } });
}

function pageBreak(): Paragraph {
  return new Paragraph({ children: [new PageBreak()] });
}

function tableRow(cells: string[], isHeader = false): TableRow {
  return new TableRow({
    children: cells.map((text) => new TableCell({
      children: [new Paragraph({
        children: [new TextRun({ text, bold: isHeader, size: isHeader ? 18 : 18 })],
        alignment: AlignmentType.LEFT,
      })],
      shading: isHeader ? { type: ShadingType.SOLID, color: "1e40af", fill: "1e40af" } : undefined,
      margins: { top: 60, bottom: 60, left: 100, right: 100 },
    })),
    tableHeader: isHeader,
  });
}

export const WordRenderer: Renderer = {
  format: "word",

  async render(report: BuiltReport): Promise<Buffer> {
    const first = report.request.entities[0] ?? "portfolio";
    const fin = (report.sections["financials"] as Record<string, unknown> | undefined)?.[first] as { monthly_pl?: MonthlyPL[]; ytd_summary?: { revenue: number; net_income: number; gross_profit: number } } | undefined;
    const metrics = ((report.sections["entity_summary"] as Record<string, { metrics: { revenue_ytd: number; net_income_ytd: number; cash_on_hand: number; open_ar: number; ar_overdue_pct: number; gross_margin_pct: number; net_margin_pct: number } } | undefined>)?.[first])?.metrics;
    const arAp = (report.sections["ar_ap"] as Record<string, { customers: { top_customers: { name: string; balance: number }[]; aging: { label: string; amount: number }[] } | null } | null> | undefined)?.[first];
    const customers = arAp?.customers?.top_customers ?? [];
    const aging = arAp?.customers?.aging ?? [];

    const tm = periodToTargetMonth(report.period);
    const allPl = fin?.monthly_pl ?? [];
    const pl = tm ? allPl.filter((x) => x.month <= tm) : allPl;
    const cur = pl[pl.length - 1];
    const prv = pl.length >= 2 ? pl[pl.length - 2] : null;

    const sections: Paragraph[] = [];

    // ── Cover ──────────────────────────────────────────────────────────────
    sections.push(
      new Paragraph({ children: [new TextRun({ text: `${report.period} Monthly Close Report`, bold: true, size: 48 })], spacing: { after: 200 } }),
      new Paragraph({ children: [new TextRun({ text: report.branding?.entityNames?.[0] ?? first, size: 28, color: "555555" })], spacing: { after: 100 } }),
      new Paragraph({ children: [new TextRun({ text: `Prepared: ${new Date(report.generatedAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`, size: 20, color: "888888" })], spacing: { after: 400 } }),
      pageBreak(),
    );

    // ── Executive Summary ──────────────────────────────────────────────────
    sections.push(h1("Executive Financial Summary"));
    if (cur && metrics) {
      const revChg = prv ? ((cur.revenue - prv.revenue) / prv.revenue * 100) : null;
      sections.push(
        p(`Revenue: ${fmt(cur.revenue)}${revChg != null ? ` (${revChg > 0 ? "+" : ""}${revChg.toFixed(1)}% vs. prior month)` : ""}`),
        p(`Gross Profit: ${fmt(cur.gross_profit)} — ${pct(cur.revenue > 0 ? cur.gross_profit / cur.revenue * 100 : 0)} margin`),
        p(`Net Income: ${fmt(cur.net_income)} — ${pct(cur.revenue > 0 ? cur.net_income / cur.revenue * 100 : 0)} margin`),
        p(`Cash on Hand: ${fmt(metrics.cash_on_hand)}`),
        p(`Open AR: ${fmt(metrics.open_ar)} (${pct(metrics.ar_overdue_pct)} overdue)`),
      );
    }
    sections.push(pageBreak());

    // ── P&L Monthly Table ──────────────────────────────────────────────────
    sections.push(h1("Profit & Loss — Monthly"));
    if (pl.length > 0) {
      const months = pl.map((x) => {
        const [y, mo] = x.month.split("-");
        return new Date(Number(y), Number(mo) - 1, 1).toLocaleString("en-US", { month: "short" });
      });
      const plTable = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          tableRow(["", ...months], true),
          tableRow(["Revenue", ...pl.map((x) => fmt(x.revenue))]),
          tableRow(["Cost of Revenue", ...pl.map((x) => fmt(x.cogs))]),
          tableRow(["Gross Profit", ...pl.map((x) => fmt(x.gross_profit))]),
          tableRow(["Gross Margin %", ...pl.map((x) => x.revenue > 0 ? pct(x.gross_profit / x.revenue * 100) : "—")]),
          tableRow(["Operating Expenses", ...pl.map((x) => fmt(x.opex))]),
          tableRow(["Net Income", ...pl.map((x) => fmt(x.net_income))]),
          tableRow(["Net Margin %", ...pl.map((x) => x.revenue > 0 ? pct(x.net_income / x.revenue * 100) : "—")]),
        ],
      });
      sections.push(plTable, new Paragraph({ spacing: { after: 200 } }));
    }
    sections.push(pageBreak());

    // ── YTD Summary ───────────────────────────────────────────────────────
    if (fin?.ytd_summary) {
      const ytd = fin.ytd_summary;
      sections.push(h1("Year-to-Date Summary"));
      const ytdTable = new Table({
        width: { size: 60, type: WidthType.PERCENTAGE },
        rows: [
          tableRow(["Metric", "YTD"], true),
          tableRow(["Revenue", fmt(ytd.revenue)]),
          tableRow(["Gross Profit", fmt(ytd.gross_profit)]),
          tableRow(["Net Income", fmt(ytd.net_income)]),
        ],
      });
      sections.push(ytdTable, new Paragraph({ spacing: { after: 200 } }), pageBreak());
    }

    // ── AR / Customer Concentration ────────────────────────────────────────
    sections.push(h1("Accounts Receivable"));
    if (aging.length > 0) {
      sections.push(h2("AR Aging Summary"));
      const totalAR = aging.reduce((s, b) => s + b.amount, 0);
      const agingTable = new Table({
        width: { size: 70, type: WidthType.PERCENTAGE },
        rows: [
          tableRow(["Aging Bucket", "Amount", "% of Total"], true),
          ...aging.map((b) => tableRow([b.label, fmt(b.amount), totalAR > 0 ? pct(b.amount / totalAR * 100) : "—"])),
          tableRow(["Total AR", fmt(totalAR), "100.0%"]),
        ],
      });
      sections.push(agingTable, new Paragraph({ spacing: { after: 200 } }));
    }
    if (customers.length > 0) {
      sections.push(h2("Top Customers by Balance"));
      const custTable = new Table({
        width: { size: 70, type: WidthType.PERCENTAGE },
        rows: [
          tableRow(["Customer", "Balance"], true),
          ...customers.filter((c) => c.balance > 0).sort((a, b) => b.balance - a.balance).slice(0, 10).map((c) => tableRow([c.name, fmt(c.balance)])),
        ],
      });
      sections.push(custTable);
    }

    const doc = new Document({
      creator: "FinanceOS",
      title: `${report.period} Monthly Close Report`,
      description: `Generated by FinanceOS for ${first}`,
      sections: [{ children: sections }],
    });

    return await Packer.toBuffer(doc);
  },
};
